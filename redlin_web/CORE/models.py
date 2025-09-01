from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from API.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Space(models.Model):
	"""
	Espacio de agrupación de contenido heterogéneo (documentos, videos, etc.)
	"""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="spaces")
	name = models.CharField(max_length=255)
	description = models.TextField(null=True, blank=True)
	visibility = models.CharField(max_length=20, choices=[('private', 'Private'), ('unlisted', 'Unlisted')], default='private')
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return self.name

class SpaceItem(models.Model):
	"""
	Relaciona cualquier tipo de contenido con un Space usando GenericForeignKey.
	"""
	space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="items")
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
	object_id = models.PositiveIntegerField()
	content_object = GenericForeignKey('content_type', 'object_id')
	topic = models.CharField(max_length=255, null=True, blank=True)
	importance = models.FloatField(default=1.0)
	added_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = (('space', 'content_type', 'object_id'),)
		indexes = [
			models.Index(fields=['space', 'content_type', 'object_id'], name='uniq_space_item'),
		]

class CoreLearningProgress(models.Model):
	"""
	Progreso SR por usuario-ítem para cualquier método de aprendizaje.
	"""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="learning_progress")
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
	object_id = models.PositiveIntegerField()
	content_object = GenericForeignKey('content_type', 'object_id')
	status = models.CharField(max_length=20, choices=[('new', 'New'), ('learning', 'Learning'), ('mastered', 'Mastered')], default='new')
	last_reviewed = models.DateTimeField(null=True, blank=True)
	next_review_at = models.DateTimeField(null=True, blank=True)
	times_shown = models.PositiveIntegerField(default=0)
	score = models.FloatField(default=0.0)
	repetitions = models.PositiveIntegerField(default=0)
	interval = models.PositiveIntegerField(default=0)
	easiness = models.FloatField(default=2.5)
	consecutive_passes = models.PositiveIntegerField(default=0)
	last_quality = models.IntegerField(default=0)

	class Meta:
		unique_together = (('user', 'content_type', 'object_id'),)
		indexes = [
			models.Index(fields=['user', 'next_review_at'], name='idx_lp_user_next'),
			models.Index(fields=['user', 'status'], name='idx_lp_user_status'),
			models.Index(fields=['user', 'content_type', 'object_id'], name='uniq_lp_user_item'),
		]

class CoreStudySession(models.Model):
	"""
	Sesión de estudio del usuario (quick, overall, etc.).
	"""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="study_sessions")
	space = models.ForeignKey(Space, null=True, blank=True, on_delete=models.SET_NULL, related_name="sessions")
	mode = models.CharField(max_length=20, choices=[('quick', 'Quick'), ('overall', 'Overall')])
	method = models.CharField(max_length=20, choices=[('MCQ', 'MCQ'), ('CLOZE', 'Cloze'), ('FEYNMAN', 'Feynman'), ('MIXED', 'Mixed')])
	started_at = models.DateTimeField(auto_now_add=True)
	ended_at = models.DateTimeField(null=True, blank=True)
	items_count = models.PositiveIntegerField(default=0)
	correct_count = models.PositiveIntegerField(default=0)
	percent = models.FloatField(default=0.0)
	passed = models.BooleanField(default=False)

	class Meta:
		indexes = [
			models.Index(fields=['user', 'started_at'], name='idx_session_user_started'),
		]

class CoreAttempt(models.Model):
	"""
	Intento individual de respuesta del usuario sobre un ítem en una sesión.
	"""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attempts")
	session = models.ForeignKey(CoreStudySession, null=True, blank=True, on_delete=models.SET_NULL, related_name="attempts")
	method = models.CharField(max_length=20, choices=[('MCQ', 'MCQ'), ('CLOZE', 'Cloze'), ('FEYNMAN', 'Feynman'), ('MIXED', 'Mixed')])
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
	object_id = models.PositiveIntegerField()
	content_object = GenericForeignKey('content_type', 'object_id')
	started_at = models.DateTimeField(auto_now_add=True)
	submitted_at = models.DateTimeField(null=True, blank=True)
	latency_ms = models.IntegerField(null=True, blank=True)
	correct = models.BooleanField(default=False)
	confidence = models.IntegerField(null=True, blank=True)
	raw_answer = models.TextField(null=True, blank=True)
	ai_score = models.FloatField(null=True, blank=True)
	ai_feedback = models.JSONField(null=True, blank=True)
	quality = models.IntegerField(default=0)

	class Meta:
		indexes = [
			models.Index(fields=['user', 'session'], name='idx_attempt_user_session'),
		]


class CoreXpAccount(models.Model):
	"""Cuenta de XP y streaks (one-to-one con User)."""
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="xp_account")
	xp_total = models.IntegerField(default=0)
	level = models.IntegerField(default=1)
	current_streak = models.IntegerField(default=0)
	longest_streak = models.IntegerField(default=0)
	last_active_date = models.DateField(null=True, blank=True)

	class Meta:
		verbose_name = "XP Account"
		verbose_name_plural = "XP Accounts"

	def __str__(self):
		return f"XPAccount(user={self.user_id}, xp={self.xp_total}, level={self.level})"

	def calculate_level(self):
		"""
		Calcula nivel basado en xp_total usando una progresión incremental.
		Modelo sencillo: nivel 1 inicia en 0.
		Requisito adicional por nivel crece linealmente (base 1000 * nivel).
		"""
		required = 0
		lvl = 1
		remaining = self.xp_total
		while True:
			increment = 1000 * lvl
			if remaining < increment:
				break
			remaining -= increment
			lvl += 1
		self.level = lvl
		return lvl

	def add_xp(self, amount: int):
		"""Añade XP y recalcula nivel (no guarda automáticamente)."""
		if amount <= 0:
			return
		self.xp_total += amount
		self.calculate_level()


class CoreXpAward(models.Model):
	"""Registro individual de un award de XP (razón y cantidad)."""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="xp_awards")
	session = models.ForeignKey('CoreStudySession', null=True, blank=True, on_delete=models.SET_NULL, related_name="xp_awards")
	amount = models.IntegerField()
	reason = models.CharField(max_length=100)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']

	def __str__(self):
		return f"Award(user={self.user_id}, amount={self.amount}, reason={self.reason})"


@receiver(post_save, sender=User)
def create_xp_account(sender, instance, created, **kwargs):
	"""Auto crea la cuenta de XP al crear un usuario."""
	if created:
		CoreXpAccount.objects.create(user=instance)
