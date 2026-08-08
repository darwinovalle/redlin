from django.db import models
from django.utils import timezone
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


class Topic(models.Model):
	"""Un tema/studio subject que el usuario estudia (la cima del kanban).

	Cada Topic posee un único Board (kanban) con Columnas y Cards de tareas.
	"""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="topics")
	name = models.CharField(max_length=255)
	color = models.CharField(max_length=16, default="#14B8A6")  # hex
	emoji = models.CharField(max_length=16, blank=True, default="")
	description = models.TextField(blank=True, default="")
	sort_order = models.PositiveIntegerField(default=0)
	archived = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["sort_order", "-created_at"]

	def __str__(self):
		return self.name


class Board(models.Model):
	"""Board kanban de un Topic (uno por tema)."""
	topic = models.OneToOneField(Topic, on_delete=models.CASCADE, related_name="board")
	title = models.CharField(max_length=255)
	color = models.CharField(max_length=16, blank=True, default="")
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return self.title


class Column(models.Model):
	"""Etapa de un board (Backlog / In progress / Review / Mastered)."""
	board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="columns")
	title = models.CharField(max_length=120)
	position = models.PositiveIntegerField(default=0)
	wip_limit = models.PositiveIntegerField(default=0)  # 0 = sin límite
	color = models.CharField(max_length=16, blank=True, default="")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["position", "id"]

	def __str__(self):
		return self.title


class Card(models.Model):
	"""Quiz Ticket del kanban; arrastrable entre columnas de un board."""
	PRIORITY_CHOICES = [
		("low", "Low"),
		("normal", "Normal"),
		("high", "High"),
	]

	column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name="cards")
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="kanban_cards")
	title = models.CharField(max_length=255)
	notes = models.TextField(blank=True, default="")
	priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="normal")
	position = models.PositiveIntegerField(default=0)
	due_date = models.DateField(null=True, blank=True)
	archived = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["position", "id"]

	def __str__(self):
		return self.title


class StudyTime(models.Model):
	"""Tiempo de estudio acumulado, opcionalmente ligado a Topic/Card/recurso."""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="study_times")
	topic = models.ForeignKey("Topic", on_delete=models.SET_NULL, null=True, blank=True, related_name="study_times")
	card = models.ForeignKey("Card", on_delete=models.SET_NULL, null=True, blank=True, related_name="study_times")
	content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
	object_id = models.PositiveIntegerField(null=True, blank=True)
	method = models.CharField(max_length=20, blank=True, default="")
	started_at = models.DateTimeField(default=timezone.now)
	seconds = models.PositiveIntegerField(default=0)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		indexes = [
			models.Index(fields=["user", "started_at"]),
			models.Index(fields=["user", "topic"]),
		]

	def __str__(self):
		return f"StudyTime(user={self.user_id}, topic={self.topic_id}, {self.seconds}s)"


class Reminder(models.Model):
	"""Notificación de recordatorio para el usuario (p.ej. ítems SR vencidos).

	La tarea Celery diaria escanea CoreLearningProgress vencidos y crea una
	Reminder resumen por usuario; el frontend la muestra en una campana/popup.
	"""
	KIND_REVIEW = "review_due"
	KIND_CHOICES = [
		(KIND_REVIEW, "Review due"),
	]

	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reminders")
	kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_REVIEW)
	subject = models.CharField(max_length=255)
	topic = models.ForeignKey("Topic", on_delete=models.CASCADE, null=True, blank=True, related_name="reminders")
	payload = models.JSONField(default=dict, blank=True)
	read_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["user", "created_at"]),
			models.Index(fields=["user", "read_at"]),
		]

	def __str__(self):
		return f"Reminder({self.kind}) user={self.user_id} {self.subject}"


class CardResource(models.Model):
	"""Enlace genérico entre un Card y un material existente.

	Apunta vía GenericForeignKey a un Document (doc/book/chapter), un Video
	o un ClassSession (lectura). No mueve ni duplica el recurso.
	"""
	card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="resources")
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
	object_id = models.PositiveIntegerField()
	content_object = GenericForeignKey("content_type", "object_id")
	added_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = [("card", "content_type", "object_id")]

	def __str__(self):
		return f"CardResource(card={self.card_id}, ct={self.content_type_id}, oid={self.object_id})"
