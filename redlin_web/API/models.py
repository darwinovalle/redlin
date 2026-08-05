from django.db import models
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone

from .services.llm_encryption import decrypt_api_key, encrypt_api_key

# Create your models here.

class User(models.Model):
    username = models.CharField(max_length=50)
    email = models.EmailField()
    password = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username
    
    @property
    def is_authenticated(self) -> bool:
        # DRF expects this attribute to exist on request.user
        return True
    
class Document(models.Model):
    SOURCE_PDF = "pdf"
    SOURCE_TRANSCRIPT = "transcript"
    SOURCE_CHOICES = [
        (SOURCE_PDF, "PDF"),
        (SOURCE_TRANSCRIPT, "Transcript"),
    ]

    KIND_DOCUMENT = "document"
    KIND_BOOK = "book"
    KIND_CHAPTER = "chapter"
    KIND_CHOICES = [
        (KIND_DOCUMENT, "Document"),
        (KIND_BOOK, "Book"),
        (KIND_CHAPTER, "Chapter"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    upload_date = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to='documents/', null=True, blank=True)
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_PDF)
    processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )

    # Books: a Book is a container Document holding the PDF; each Chapter is its
    # own Document that reuses the book's pdf_file but processes only its range.
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_DOCUMENT)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chapters",
    )
    page_start = models.PositiveIntegerField(null=True, blank=True)
    page_end = models.PositiveIntegerField(null=True, blank=True)
    # Processing metadata: total pages, processed page range, etc.
    source_meta = models.JSONField(default=dict, blank=True)

    @property
    def is_book(self):
        return self.kind == self.KIND_BOOK

    @property
    def is_chapter(self):
        return self.kind == self.KIND_CHAPTER

    @property
    def source_document(self):
        """The document whose pdf_file should be served/extracted (parent for chapters)."""
        return self.parent if (self.is_chapter and self.parent_id) else self

    def __str__(self):
        return self.title


class DocumentHighlight(models.Model):
    """User text highlights over a document's PDF pages (stored as overlay data)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='document_highlights')
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='highlights')
    page = models.PositiveIntegerField(default=1)
    text = models.TextField(blank=True, default='')
    color = models.CharField(max_length=32, default='#FDE047')
    # Normalized rects (x, y, w, h as 0..1 fractions of the page box) so the
    # overlay re-renders correctly at any zoom level.
    rects = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['page', 'created_at']
        indexes = [
            models.Index(fields=['document', 'page']),
        ]

    def __str__(self):
        return f"Highlight on doc {self.document_id} p.{self.page}"


class Summary(models.Model):
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='summary')
    content = models.TextField()

    def __str__(self):
        return f"Summary for {self.document.title}"

class Flashcard(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='flashcards')
    key_term = models.CharField(max_length=255)
    definition = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[('still_learning', 'Still Learning'), ('mastered', 'Mastered')],
        default='still_learning'
    )
    last_reviewed = models.DateTimeField(auto_now=True)

    # Review metadata
    next_review_at = models.DateTimeField(null=True, blank=True)
    times_shown = models.PositiveIntegerField(default=0)

    # Scoring/SR (SM-2 inspired)
    score = models.FloatField(default=0.0)  # 0..1 normalized mastery score
    repetitions = models.PositiveIntegerField(default=0)
    interval = models.PositiveIntegerField(default=0)  # days
    easiness = models.FloatField(default=2.5)  # SM-2 E-Factor baseline

    class Meta:
        indexes = [
            models.Index(fields=["document", "next_review_at"]),
            models.Index(fields=["document", "status"]),
        ]

    def __str__(self):
        return self.key_term

    def schedule_for(self, days: int) -> None:
        self.interval = max(1, int(days))
        self.next_review_at = timezone.now() + timezone.timedelta(days=self.interval)

class MCQ(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='mcqs')
    question = models.TextField()
    correct_answer = models.CharField(max_length=255)
    option_1 = models.CharField(max_length=255)
    option_2 = models.CharField(max_length=255)
    option_3 = models.CharField(max_length=255)

    def __str__(self):
        return self.question


class Cloze(models.Model):
    """Fill-in-the-blank generated from a Document.

    text_with_blank: Text containing a placeholder (e.g. 'The capital of France is ____.')
    answer: Correct answer expected to fill the blank
    context: Optional extended context or explanation snippet
    source_span: Optional raw citation / substring from the source document
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='clozes')
    text_with_blank = models.TextField()
    answer = models.CharField(max_length=255)
    context = models.TextField(blank=True, default='')
    source_span = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Nuevo: opciones (distractores), metadata (blanks multi, strategy, spans), dificultad
    options = models.JSONField(default=list, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    difficulty = models.CharField(max_length=10, default='medium', choices=[('easy','Easy'),('medium','Medium'),('hard','Hard')])

    class Meta:
        indexes = [
            models.Index(fields=['document']),
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"Cloze {self.pk} for doc {self.document_id}"


class Feynman(models.Model):
    """User explanation (Feynman technique) tied to a Document.

    prompt: Original question or concept to explain.
    key_points: Structured JSON (list/dict) of essential points expected.
    reference: Optional raw text snippet or citation from the document.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='feynmans')
    prompt = models.TextField()
    key_points = models.JSONField(default=list)  # could be list of strings or dict with weights
    reference = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['document']),
        ]

    def __str__(self) -> str:  # pragma: no cover - simple
        return f"Feynman {self.pk} doc {self.document_id}"


class FeynmanAttempt(models.Model):
    """User's explanation attempt for a Feynman prompt.

    Stores raw answer, LLM scoring (1-100), tier classification, and structured breakdown.
    key_points_coverage: optional normalized coverage (0..1) for quick filtering.
    """
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='feynman_attempts')
    feynman = models.ForeignKey(Feynman, on_delete=models.CASCADE, related_name='attempts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feynman_attempts')
    answer_text = models.TextField()
    score = models.PositiveIntegerField(null=True, blank=True)  # 1..100; null if eval failed
    tier = models.CharField(max_length=20, blank=True, default='')  # deficient|acceptable|outstanding
    breakdown = models.JSONField(default=dict, blank=True)  # {coverage, accuracy, clarity, simplicity, misconceptions_penalty, hallucination_penalty, feedback, prompt_log}
    key_points_coverage = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['document','user','feynman']),
            models.Index(fields=['score']),
        ]

    def classify_tier(self) -> str:
        if self.score is None:
            return ''
        if self.score < 60:
            return 'Poor'
        if self.score < 80:
            return 'Satisfactory'
        return 'Excellent'

    def save(self, *args, **kwargs):  # pragma: no cover - small logic
        if self.score is not None:
            self.tier = self.classify_tier()
        super().save(*args, **kwargs)


class UserLLMSettings(models.Model):
    """Per-user LLM provider configuration.

    The API key is stored Fernet-encrypted at rest; only ``encrypted_api_key``
    (ciphertext) ever touches the DB. The ``api_key`` property decrypts in
    memory for generation calls and encrypts on assignment.
    """

    PROVIDER_CHOICES = [
        ("gemini", "Gemini"),
        ("claude", "Claude (Anthropic)"),
        ("openai", "OpenAI"),
        ("ollama", "Ollama"),
        ("nvidia_nim", "Nvidia NIM"),
        ("openrouter", "OpenRouter"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='llm_settings')
    provider = models.CharField(max_length=32, choices=PROVIDER_CHOICES, default="gemini")
    encrypted_api_key = models.TextField(blank=True, default="")  # Fernet ciphertext, never served plaintext
    base_url = models.CharField(max_length=500, blank=True, default="")  # Ollama host / NIM / OpenRouter
    model_name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def api_key(self) -> str | None:
        if not self.encrypted_api_key:
            return None
        return decrypt_api_key(self.encrypted_api_key)

    @api_key.setter
    def api_key(self, value: str | None) -> None:
        self.encrypted_api_key = encrypt_api_key(value) if value else ""

    def __str__(self) -> str:
        return f"LLM settings for {self.user.username}"


# Suggested UML Diagram Description:
# 1. User has a one-to-many relationship with Document.
# 2. Document has a one-to-one relationship with Summary.
# 3. Document has a one-to-many relationship with Flashcard and MCQ.
#
# Possible Django Workflow for Implementation:
# 1. User uploads a PDF via a form, stored in the Document model.
# 2. Backend processing generates:
#    - A summary (Summary model instance).
#    - Flashcards (Flashcard model instances).
#    - MCQs (MCQ model instances).
# 3. All generated data links back to the user and document.
# 4. The frontend retrieves data for the user to review and test their knowledge.
# 5. Flashcards include a status field (Still Learning/Mastered), and a review algorithm can prioritize "Still Learning" cards.
# 6. MCQs provide a way to test knowledge retention.
# 7. The user can track their progress and review history.
# 8. The user can upload more documents for processing.
