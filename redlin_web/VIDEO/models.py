from django.db import models
from django.utils import timezone
from API.models import User  # Reusa el User existente

class Video(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='videos')
    url = models.URLField()
    video_id = models.CharField(max_length=32, db_index=True, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processing_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')],
        default='pending'
    )
    snippet_count = models.PositiveIntegerField(default=0)
    transcript_text = models.TextField(blank=True, default='')

    def __str__(self):
        return self.title or self.video_id or f"Video {self.pk}"

class VideoSummary(models.Model):
    video = models.OneToOneField(Video, on_delete=models.CASCADE, related_name='summary')
    content = models.TextField()

    def __str__(self):
        return f"Summary for {self.video.video_id or self.video_id}"

class VideoMCQ(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='mcqs')
    question = models.TextField()
    correct_answer = models.CharField(max_length=255)
    option_1 = models.CharField(max_length=255)
    option_2 = models.CharField(max_length=255)
    option_3 = models.CharField(max_length=255)

    def __str__(self):
        return self.question


class VideoCloze(models.Model):
    """Fill-in-the-blank generated from a Video transcript/chunk."""
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='clozes')
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
            models.Index(fields=['video']),
        ]

    def __str__(self):  # pragma: no cover - trivial
        return f"VideoCloze {self.pk} for video {self.video_id}"


class VideoFeynman(models.Model):
    """Feynman explanation attempt linked to a Video."""
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='feynmans')
    prompt = models.TextField()
    key_points = models.JSONField(default=list)
    reference = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['video']),
        ]

    def __str__(self):  # pragma: no cover
        return f"VideoFeynman {self.pk} video {self.video_id}"


class VideoFeynmanAttempt(models.Model):
    """User explanation attempt for a VideoFeynman prompt."""
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='feynman_attempts')
    feynman = models.ForeignKey(VideoFeynman, on_delete=models.CASCADE, related_name='attempts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_feynman_attempts')
    answer_text = models.TextField()
    score = models.PositiveIntegerField(null=True, blank=True)
    tier = models.CharField(max_length=20, blank=True, default='')
    breakdown = models.JSONField(default=dict, blank=True)
    key_points_coverage = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['video','user','feynman']),
            models.Index(fields=['score']),
        ]

    def classify_tier(self) -> str:  # pragma: no cover
        if self.score is None:
            return ''
        if self.score < 60:
            return 'deficiente'
        if self.score < 80:
            return 'aceptable'
        return 'sobresaliente'

    def save(self, *args, **kwargs):  # pragma: no cover
        if self.score is not None:
            self.tier = self.classify_tier()
        super().save(*args, **kwargs)
