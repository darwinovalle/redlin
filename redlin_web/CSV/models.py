from django.db import models
from django.utils import timezone

# We deliberately depend on the local API app's simple User model
# to keep the linkage consistent with the rest of the project.
from API.models import User


class CSVImport(models.Model):
	"""Tracks a CSV import initiated by a user.

	We don't persist the file itself to avoid extra MEDIA configuration for now.
	We keep simple metadata that lets us trace generated flashcards back to an
	import event.
	"""

	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="csv_imports")
	filename = models.CharField(max_length=255)
	row_count = models.PositiveIntegerField(default=0)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:
		return f"CSVImport({self.filename}) by {self.user_id}"


class CSVFlashcard(models.Model):
	"""User-owned flashcard generated from a CSV import.

	Mirrors the API.Flashcard shape where it makes sense, but links directly to
	the User and a CSVImport "source" instead of a Document. Includes basic
	spaced-repetition fields and a rolling score to prioritize practice.
	"""

	STATUS_CHOICES = (
		("still_learning", "Still Learning"),
		("mastered", "Mastered"),
	)

	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="csv_flashcards")
	source = models.ForeignKey(CSVImport, on_delete=models.CASCADE, related_name="flashcards")

	# Core content (aligned with API.Flashcard fields)
	key_term = models.CharField(max_length=255)
	definition = models.TextField()
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="still_learning")

	# Review metadata
	last_reviewed = models.DateTimeField(auto_now=True)
	next_review_at = models.DateTimeField(null=True, blank=True)
	times_shown = models.PositiveIntegerField(default=0)

	# Scoring/SR (SM-2 inspired)
	score = models.FloatField(default=0.0)  # 0..1 normalized mastery score
	repetitions = models.PositiveIntegerField(default=0)
	interval = models.PositiveIntegerField(default=0)  # days
	easiness = models.FloatField(default=2.5)  # SM-2 E-Factor baseline

	class Meta:
		unique_together = ("user", "key_term")
		indexes = [
			models.Index(fields=["user", "next_review_at"]),
			models.Index(fields=["user", "status"]),
		]

	def __str__(self) -> str:
		return self.key_term

	def schedule_for(self, days: int) -> None:
		self.interval = max(1, int(days))
		self.next_review_at = timezone.now() + timezone.timedelta(days=self.interval)

