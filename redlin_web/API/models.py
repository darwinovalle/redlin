from django.db import models
from django.utils import timezone

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
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    upload_date = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to='documents/')
    processing_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed')],
        default='pending'
    )

    def __str__(self):
        return self.title

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

    class Meta:
        indexes = [
            models.Index(fields=['document']),
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"Cloze {self.pk} for doc {self.document_id}"

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
