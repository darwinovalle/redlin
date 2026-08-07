from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .models import Space, Topic, Column, Card, CardResource
from .serializers import (
    SpaceSerializer,
    TopicSerializer,
    ColumnSerializer,
    CardSerializer,
    CardResourceSerializer,
)
from API.jwt_auth import JWTAuthentication


class SpaceViewSet(viewsets.ModelViewSet):
	"""CRUD de Spaces restringido al owner.

	Características:
	- Solo devuelve spaces del usuario autenticado.
	- Crea space asignando automáticamente el user.
	- Búsqueda por `name` o `description` (?search=).
	- Filtros simples: visibility, created_before, created_after.
	- Ordenamiento (?ordering=created_at|-created_at; default -created_at).
	"""
	serializer_class = SpaceSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]
	filter_backends = [filters.SearchFilter, filters.OrderingFilter]
	search_fields = ['name', 'description']
	ordering = ['-created_at']
	ordering_fields = ['created_at', 'name']

	def get_queryset(self):
		user = self.request.user
		qs = Space.objects.filter(user=user)
		vis = self.request.query_params.get('visibility')
		if vis in ('private', 'unlisted'):
			qs = qs.filter(visibility=vis)
		created_before = self.request.query_params.get('created_before')
		created_after = self.request.query_params.get('created_after')
		# Expect ISO datetime (date accepted) strings; silently ignore parse errors
		from django.utils.dateparse import parse_datetime, parse_date
		if created_after:
			dt = parse_datetime(created_after) or parse_date(created_after)
			if dt:
				qs = qs.filter(created_at__gte=dt)
		if created_before:
			dt = parse_datetime(created_before) or parse_date(created_before)
			if dt:
				qs = qs.filter(created_at__lte=dt)
		return qs

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)

	# Override destroy/update to ensure object belongs to user (get_queryset already filters)
	# but keep explicit 404 behavior for clarity.
	def update(self, request, *args, **kwargs):  # type: ignore[override]
		instance = self.get_object()  # filtered by owner
		return super().update(request, *args, **kwargs)

	def destroy(self, request, *args, **kwargs):  # type: ignore[override]
		instance = self.get_object()
		self.perform_destroy(instance)
		return Response(status=status.HTTP_204_NO_CONTENT)


def _renumber(items):
	"""Reassign sequential positions (0..n-1) to an ordered queryset."""
	for i, item in enumerate(items):
		item.__class__.objects.filter(pk=item.pk).update(position=i)


# ---------------------------------------------------------------- kanban ---

class TopicViewSet(viewsets.ModelViewSet):
	"""CRUD de Subjects (Topics) restringido al owner; crea el Board por defecto."""
	serializer_class = TopicSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Topic.objects.filter(user=self.request.user)

	def perform_create(self, serializer):
		serializer.save()  # TopicSerializer.create inyecta user + default board

	def destroy(self, request, *args, **kwargs):  # type: ignore[override]
		instance = self.get_object()
		self.perform_destroy(instance)
		return Response(status=status.HTTP_204_NO_CONTENT)


class ColumnViewSet(viewsets.ModelViewSet):
	"""CRUD de Columnas de un Board, restringido al owner."""
	serializer_class = ColumnSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Column.objects.filter(board__topic__user=self.request.user)

	def _assert_owner(self, column):
		if column.board.topic.user_id != self.request.user.id:
			raise PermissionDenied("This column belongs to another user.")

	def perform_create(self, serializer):
		board = serializer.validated_data["board"]
		# Build a temp Column to verify ownership before saving.
		probe = Column(board=board)
		self._assert_owner(probe)
		serializer.save(position=board.columns.count())

	def perform_destroy(self, instance):
		board = instance.board
		_renumber(board.columns.order_by("position", "id"))
		super().perform_destroy(instance)


class CardViewSet(viewsets.ModelViewSet):
	"""CRUD de Cards del kanban; soporta mover entre columnas (PATCH column)."""
	serializer_class = CardSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Card.objects.filter(user=self.request.user).select_related(
			"column", "column__board", "column__board__topic"
		)

	def _assert_owner(self, column):
		if column.board.topic.user_id != self.request.user.id:
			raise PermissionDenied("This column belongs to another user.")

	def perform_create(self, serializer):
		column = serializer.validated_data["column"]
		self._assert_owner(column)
		serializer.save(user=self.request.user, position=column.cards.count())

	def update(self, request, *args, **kwargs):  # type: ignore[override]
		partial = kwargs.pop("partial", False)
		instance = self.get_object()
		serializer = self.get_serializer(instance, data=request.data, partial=True)
		serializer.is_valid(raise_exception=True)
		old_column_id = instance.column_id
		new_column = serializer.validated_data.get("column")
		if new_column is not None and new_column.pk != old_column_id:
			self._assert_owner(new_column)
			# Append to the end of the target column on a drag-move.
			serializer.validated_data["position"] = new_column.cards.count()
		serializer.save()
		_renumber(instance.column.cards.all())
		if new_column is not None and new_column.pk != old_column_id:
			_renumber(Column.objects.get(pk=old_column_id).cards.all())
		instance.refresh_from_db()
		return Response(self.get_serializer(instance).data)

	def perform_destroy(self, instance):
		column = instance.column
		_renumber(column.cards.order_by("position", "id"))
		super().perform_destroy(instance)


class CardResourceViewSet(viewsets.ModelViewSet):
	"""Adjunta/desadjunta material existente a un Card (GenericFK)."""
	serializer_class = CardResourceSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		qs = CardResource.objects.filter(card__user=self.request.user)
		card_id = self.request.query_params.get("card")
		if card_id:
			qs = qs.filter(card_id=card_id)
		return qs

	def perform_create(self, serializer):
		card = serializer.validated_data["card"]
		if card.user_id != self.request.user.id:
			raise PermissionDenied("This card belongs to another user.")
		serializer.save()


# ------------------------------------------------------------- analytics ---

from rest_framework.decorators import api_view  # noqa: E402
from django.db import transaction  # noqa: E402
from django.db.models import Sum  # noqa: E402
from django.utils import timezone  # noqa: E402

from .models import Topic as TopicModel, Card as CardModel, StudyTime, CoreAttempt, CoreLearningProgress  # noqa: E402
from .serializers import StudyTimeSerializer  # noqa: E402


def _per_method_breakdown(user, method):
	qs = CoreAttempt.objects.filter(user=user, method=method)
	total = qs.count()
	correct = qs.filter(correct=True).count()
	return {
		"total": total,
		"correct": correct,
		"percent": round(correct / total * 100, 1) if total else 0,
	}


def _stats_payload(user):
	xp = user.xp_account
	today = timezone.localdate()
	attempts_total = CoreAttempt.objects.filter(user=user).count()
	attempts_ok = CoreAttempt.objects.filter(user=user, correct=True).count()
	study_total = StudyTime.objects.filter(user=user).aggregate(t=Sum("seconds"))["t"] or 0
	per_topic = list(
		StudyTime.objects.filter(user=user)
		.exclude(topic__isnull=True)
		.values("topic_id", "topic__name")
		.annotate(seconds=Sum("seconds"))
		.order_by("-seconds")
	)
	per_day = list(
		StudyTime.objects.filter(user=user)
		.values("started_at__date")
		.annotate(seconds=Sum("seconds"))
		.order_by("started_at__date")
	)
	due_count = CoreLearningProgress.objects.filter(
		user=user, next_review_at__lte=timezone.now()
	).count()
	return {
		"streak": {
			"current": xp.current_streak,
			"longest": xp.longest_streak,
			"today_active": xp.last_active_date == today,
		},
		"xp": {"total": xp.xp_total, "level": xp.level},
		"overall": {
			"total": attempts_total,
			"correct": attempts_ok,
			"percent": round(attempts_ok / attempts_total * 100, 1) if attempts_total else 0,
		},
		"methods": {
			m: _per_method_breakdown(user, m)
			for m in ("MCQ", "CLOZE", "FEYNMAN", "MIXED")
		},
		"study": {"total_seconds": study_total, "per_topic": per_topic, "per_day": per_day},
		"due": {"count": due_count},
	}


@api_view(["POST"])
def attempt_view(request):
	"""Registra una respuesta y avanza scheduling SR + streak + XP (transaction)."""
	from CORE.services.srs import record_attempt, resolve_target

	data = request.data
	ct_id, oid = data.get("content_type_id"), data.get("object_id")
	if not ct_id or oid is None:
		return Response({"error": "content_type_id and object_id are required"}, status=400)
	ct_id, oid = int(ct_id), int(oid)
	if resolve_target(ct_id, oid) is None:
		return Response({"error": "unknown content target"}, status=400)
	method = str(data.get("method") or "MCQ").upper()
	with transaction.atomic():
		result = record_attempt(
			user=request.user, method=method, content_type_id=ct_id, object_id=oid,
			correct=bool(data.get("correct")), latency_ms=data.get("latency_ms"),
			raw_answer=data.get("raw_answer"), ai_score=data.get("ai_score"),
		)
	return Response(result, status=201)


@api_view(["POST", "GET"])
def study_view(request):
	"""POST: registra tiempo de estudio. GET: retorna analytics completos."""
	if request.method == "POST":
		data = request.data
		topic = TopicModel.objects.filter(id=data.get("topic"), user=request.user).first() if data.get("topic") else None
		card = CardModel.objects.filter(id=data.get("card"), user=request.user).first() if data.get("card") else None
		try:
			seconds = max(0, min(int(data.get("seconds") or 0), 86400))
		except (TypeError, ValueError):
			seconds = 0
		st = StudyTime.objects.create(
			user=request.user, topic=topic, card=card,
			method=str(data.get("method") or ""), seconds=seconds,
			object_id=data.get("object_id"),
		)
		return Response(StudyTimeSerializer(st).data, status=201)
	return Response(_stats_payload(request.user))


@api_view(["GET"])
def stats_view(request):
	return Response(_stats_payload(request.user))


@api_view(["GET"])
def reminders_due_view(request):
	"""Ítems de SR vencidos (next_review_at <= now) con su texto para revisar."""
	from CORE.services.srs import resolve_target

	now = timezone.now()
	rows = CoreLearningProgress.objects.filter(
		user=request.user, next_review_at__lte=now
	).order_by("next_review_at")
	items = []
	for p in rows:
		target = resolve_target(p.content_type_id, p.object_id)
		if target is None:
			continue
		question = (
			getattr(target, "question", None)
			or getattr(target, "text_with_blank", None)
			or getattr(target, "prompt", None)
			or str(target)
		)
		model = p.content_type.model if p.content_type_id else ""
		method = "FEYNMAN" if "feynman" in model else ("CLOZE" if "cloze" in model else "MCQ")
		items.append({
			"progress_id": p.id, "content_type": model, "content_type_id": p.content_type_id,
			"object_id": p.object_id,
			"method": method, "question": question, "status": p.status,
			"interval_days": p.interval, "due_at": p.next_review_at,
		})
	return Response({"count": len(items), "items": items})