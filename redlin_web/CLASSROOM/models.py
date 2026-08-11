from django.db import models
from django.utils import timezone

from API.models import Document, User


class ClassSession(models.Model):
    # A fresh session starts "new" (created, nothing captured yet). It is only
    # ever considered "recording" once the client has actually started capture,
    # so an idle, never-opened space doesn't sit in a live-recording state.
    STATUS_NEW = "new"
    STATUS_RECORDING = "recording"
    STATUS_STOPPED = "stopped"
    STATUS_TRANSCRIBING = "transcribing"
    STATUS_READY = "ready"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_NEW, "New"),
        (STATUS_RECORDING, "Recording"),
        (STATUS_STOPPED, "Stopped"),
        (STATUS_TRANSCRIBING, "Transcribing"),
        (STATUS_READY, "Ready"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="class_sessions")
    linked_document = models.ForeignKey(
        Document,
        on_delete=models.SET_NULL,
        related_name="class_sessions",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_RECORDING)
    language = models.CharField(max_length=8, default="en")
    audio_file = models.FileField(upload_to="class_audio/", null=True, blank=True)
    # Optional cover image shown in the /classroom directory card.
    cover_image = models.FileField(upload_to="class_covers/", null=True, blank=True)
    transcript_text = models.TextField(blank=True, default="")
    source_meta = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"ClassSession {self.id} - {self.title}"


class TranscriptSegment(models.Model):
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name="segments")
    sequence = models.PositiveIntegerField()
    start_sec = models.FloatField(null=True, blank=True)
    end_sec = models.FloatField(null=True, blank=True)
    speaker_label = models.CharField(max_length=64, blank=True, default="")
    text = models.TextField()
    confidence = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence", "id"]
        constraints = [
            models.UniqueConstraint(fields=["class_session", "sequence"], name="uniq_session_segment_sequence"),
        ]
        indexes = [
            models.Index(fields=["class_session", "sequence"]),
        ]

    def __str__(self) -> str:
        return f"Segment {self.sequence} session {self.class_session_id}"


class ClassSessionSummary(models.Model):
    class_session = models.OneToOneField(ClassSession, on_delete=models.CASCADE, related_name='summary')
    content = models.TextField()

    def __str__(self):
        return f"Summary for session {self.class_session_id}"


class ClassSessionMCQ(models.Model):
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='mcqs')
    question = models.TextField()
    correct_answer = models.CharField(max_length=255)
    option_1 = models.CharField(max_length=255)
    option_2 = models.CharField(max_length=255)
    option_3 = models.CharField(max_length=255)

    def __str__(self):
        return self.question


class ClassSessionCloze(models.Model):
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='clozes')
    text_with_blank = models.TextField()
    answer = models.CharField(max_length=255)
    context = models.TextField(blank=True, default='')
    source_span = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    options = models.JSONField(default=list, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    difficulty = models.CharField(max_length=10, default='medium', choices=[('easy','Easy'),('medium','Medium'),('hard','Hard')])

    class Meta:
        indexes = [
            models.Index(fields=['class_session']),
        ]

    def __str__(self) -> str:
        return f"Cloze {self.pk} for session {self.class_session_id}"


class ClassSessionFeynman(models.Model):
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='feynmans')
    prompt = models.TextField()
    key_points = models.JSONField(default=list)
    reference = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['class_session']),
        ]

    def __str__(self) -> str:
        return f"Feynman {self.pk} session {self.class_session_id}"


class ClassSessionFeynmanAttempt(models.Model):
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='feynman_attempts')
    feynman = models.ForeignKey(ClassSessionFeynman, on_delete=models.CASCADE, related_name='attempts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='class_feynman_attempts')
    answer_text = models.TextField()
    score = models.PositiveIntegerField(null=True, blank=True)
    tier = models.CharField(max_length=20, blank=True, default='')
    breakdown = models.JSONField(default=dict, blank=True)
    key_points_coverage = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['class_session','user','feynman']),
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

    def save(self, *args, **kwargs):
        if self.score is not None:
            self.tier = self.classify_tier()
        super().save(*args, **kwargs)
