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

    class Meta:
        indexes = [
            models.Index(fields=['video']),
        ]

    def __str__(self):  # pragma: no cover - trivial
        return f"VideoCloze {self.pk} for video {self.video_id}"
