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
from django.contrib.contenttypes.models import ContentType  # noqa: E402

from .models import Topic as TopicModel, Card as CardModel, StudyTime, CoreAttempt, CoreLearningProgress, CoreStudySession  # noqa: E402
from .serializers import StudyTimeSerializer  # noqa: E402


# Friendly slug -> (app_label, model) so the frontend can post an attempt with
# just {model, item_id} instead of knowing content-type ids.
MODEL_SLUGS = {
	"mcq": ("API", "mcq"),
	"cloze": ("API", "cloze"),
	"feynman": ("API", "feynman"),
	"video_mcq": ("VIDEO", "videomcq"),
	"video_cloze": ("VIDEO", "videocloze"),
	"video_feynman": ("VIDEO", "videofeynman"),
	"class_mcq": ("CLASSROOM", "classsessionmcq"),
	"class_cloze": ("CLASSROOM", "classsessioncloze"),
	"class_feynman": ("CLASSROOM", "classsessionfeynman"),
}


def _per_method_breakdown(user, method):
	qs = CoreAttempt.objects.filter(user=user, method=method)
	total = qs.count()
	correct = qs.filter(correct=True).count()
	return {
		"total": total,
		"correct": correct,
		"percent": round(correct / total * 100, 1) if total else 0,
	}


# Map a quiz content-type -> the FK that points to its source (document/video/lecture).
SOURCE_PARENT = {
	("API", "mcq"): ("document", "document"),
	("API", "cloze"): ("document", "document"),
	("API", "feynman"): ("document", "document"),
	("VIDEO", "videomcq"): ("video", "video"),
	("VIDEO", "videocloze"): ("video", "video"),
	("VIDEO", "videofeynman"): ("video", "video"),
	("CLASSROOM", "classsessionmcq"): ("class_session", "lecture"),
	("CLASSROOM", "classsessioncloze"): ("class_session", "lecture"),
	("CLASSROOM", "classsessionfeynman"): ("class_session", "lecture"),
}


def _feynman_summary(user):
	"""Feynman session metrics: sessions, total time, average score."""
	sessions = list(CoreStudySession.objects.filter(user=user, method="FEYNMAN"))
	total_seconds = sum(
		int((s.ended_at - s.started_at).total_seconds())
		for s in sessions if s.ended_at and s.started_at
	)
	avg = round(sum(s.percent for s in sessions) / len(sessions), 1) if sessions else 0
	return {
		"sessions": len(sessions),
		"total_seconds": total_seconds,
		"avg_score": avg,
	}


def _source_stats(user):
	"""Per-source (document/video/lecture) quiz accuracy from the user's attempts."""
	from collections import defaultdict

	attempts = CoreAttempt.objects.filter(user=user)
	cts = attempts.values_list("content_type_id", flat=True).distinct()
	per = {}  # (kind, id) -> {type, title, methods:{method:{total,correct}}}

	def ensure(kind, sid, title):
		key = (kind, sid)
		if key not in per:
			per[key] = {"id": sid, "type": kind, "title": title,
						"methods": {"MCQ": {"total": 0, "correct": 0}, "CLOZE": {"total": 0, "correct": 0},
									"FEYNMAN": {"total": 0, "correct": 0}}}
		return per[key]

	for ct_id in cts:
		ct = ContentType.objects.get(pk=ct_id)
		key = (ct.app_label, ct.model)
		if key not in SOURCE_PARENT:
			continue
		parent_attr, kind = SOURCE_PARENT[key]
		ids = list(attempts.filter(content_type_id=ct_id).values_list("object_id", flat=True).distinct())
		model = ct.model_class()
		obj_to_parent = {}
		for obj in model.objects.filter(pk__in=ids).select_related(parent_attr):
			par = getattr(obj, parent_attr)
			if par is not None:
				obj_to_parent[obj.pk] = par
		for a in attempts.filter(content_type_id=ct_id):
			par = obj_to_parent.get(a.object_id)
			if par is None:
				continue
			entry = ensure(kind, par.id, getattr(par, "title", "") or "Untitled")
			key_m = a.method if a.method in entry["methods"] else "MCQ"
			if a.method not in entry["methods"]:
				entry["methods"][a.method] = {"total": 0, "correct": 0}
			entry["methods"][a.method]["total"] += 1
			if a.correct:
				entry["methods"][a.method]["correct"] += 1

	out = []
	for entry in per.values():
		ov_total = ov_correct = 0
		for m in entry["methods"]:
			v = entry["methods"][m]
			if v["total"]:
				v["percent"] = round(v["correct"] / v["total"] * 100, 1)
				ov_total += v["total"]
				ov_correct += v["correct"]
			else:
				v["percent"] = 0
		entry["overall"] = {
			"total": ov_total,
			"correct": ov_correct,
			"percent": round(ov_correct / ov_total * 100, 1) if ov_total else 0,
		}
		out.append(entry)
	out.sort(key=lambda x: -x["overall"]["total"])
	return out


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
	today = timezone.localdate()
	today_attempts = CoreAttempt.objects.filter(user=user, started_at__date=today).count()
	today_study = StudyTime.objects.filter(user=user, started_at__date=today).aggregate(t=Sum("seconds"))["t"] or 0
	daily_avg = round(study_total / len(per_day), 1) if per_day else 0
	return {
		"streak": {
			"current": xp.current_streak,
			"longest": xp.longest_streak,
			"today_active": xp.last_active_date == today,
			"last_active_date": xp.last_active_date.isoformat() if xp.last_active_date else None,
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
		"study_sources": _source_study_time(user),
		"per_source": _source_stats(user),
		"feynman": _feynman_summary(user),
		"due": {"count": due_count},
		"today": {"attempts": today_attempts, "study_seconds": today_study},
		"averages": {"daily_study_seconds": daily_avg},
	}


@api_view(["POST"])
def attempt_view(request):
	"""Registra una respuesta y avanza scheduling SR + streak + XP (transaction)."""
	from CORE.services.srs import record_attempt, resolve_target
	from django.contrib.contenttypes.models import ContentType

	data = request.data
	ct_id, oid = data.get("content_type_id"), data.get("object_id")
	model = data.get("model")
	if model and model in MODEL_SLUGS:
		app_label, model_name = MODEL_SLUGS[model]
		ct_id = ContentType.objects.get(app_label=app_label, model=model_name).id
		oid = data.get("item_id") or oid
	if not ct_id or oid is None:
		return Response(
			{"error": "content_type_id+object_id (or model+item_id) are required"},
			status=400,
		)
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


STUDY_RESOURCE_MODELS = {
	"document": ("API", "document"),
	"video": ("VIDEO", "video"),
	"lecture": ("CLASSROOM", "classsession"),
}

# StudyTime content-type -> grouped source kind for the per-source rollup.
STUDY_SOURCE_KIND = {
	("API", "document"): "document",
	("VIDEO", "video"): "video",
	("CLASSROOM", "classsession"): "lecture",
}


def _source_of_qi(item):
	"""Given a quiz item (MCQ/Cloze/Feynman), return its source (kind, id, title)."""
	for attr, kind in (("document", "document"), ("video", "video"), ("class_session", "lecture")):
		if hasattr(item, attr):
			ref = getattr(item, attr)
			if ref is not None:
				return kind, ref.id, getattr(ref, "title", "") or "Untitled"
	return None


def _feynman_seconds_by_source(user):
	"""Feynman session seconds attributed to their source via the session's items."""
	from collections import defaultdict
	from CORE.services.srs import resolve_target

	lookup = {}
	for s in CoreStudySession.objects.filter(user=user, method="FEYNMAN"):
		if not (s.ended_at and s.started_at):
			continue
		seconds = int((s.ended_at - s.started_at).total_seconds())
		att = CoreAttempt.objects.filter(user=user, session=s, method="FEYNMAN").select_related("content_type").first()
		if att is None:
			continue
		item = resolve_target(att.content_type_id, att.object_id)
		src = _source_of_qi(item) if item is not None else None
		if src is None:
			continue
		key = (src[0], src[1])
		cur = lookup.get(key)
		if cur is None:
			lookup[key] = {"title": src[2], "seconds": 0}
		lookup[key]["seconds"] += seconds
	return lookup


def _source_study_time(user):
	"""Study seconds rolled up per source (document / book / video / lecture),
	including the part spent on Feynman sessions (`feynman_seconds`).

	Book chapters are grouped under their parent Book (a book is a Document with
	kind='book'; chapters have kind='chapter' + parent).
	"""
	rows = StudyTime.objects.filter(user=user).exclude(content_type__isnull=True)
	per = {}

	def ensure(kind, sid, title=None):
		key = (kind, sid)
		if key not in per:
			per[key] = {
				"id": sid, "type": kind, "title": title or "Untitled",
				"seconds": 0, "feynman_seconds": 0,
				"methods": {"MCQ": 0, "CLOZE": 0, "FEYNMAN": 0},
			}
		elif title:
			per[key]["title"] = title
		return per[key]

	SECTION_METHODS = ("MCQ", "CLOZE", "FEYNMAN")

	cts = rows.values_list("content_type_id", flat=True).distinct()
	for ct_id in cts:
		ct = ContentType.objects.get(pk=ct_id)
		kind = STUDY_SOURCE_KIND.get((ct.app_label, ct.model))
		if kind is None:
			continue
		model = ct.model_class()
		ids = list(rows.filter(content_type_id=ct_id).values_list("object_id", flat=True).distinct())
		objs = model.objects.in_bulk(ids)
		for st in rows.filter(content_type_id=ct_id):
			obj = objs.get(st.object_id)
			if obj is None:
				continue
			title = getattr(obj, "title", "") or "Untitled"
			if kind == "document":
				k = getattr(obj, "kind", "document")
				if k == "book":
					entry = ensure("book", obj.id, title)
				elif k == "chapter" and getattr(obj, "parent", None) is not None:
					parent = obj.parent
					entry = ensure("book", parent.id, getattr(parent, "title", "") or title)
				else:
					entry = ensure("document", obj.id, title)
			else:
				entry = ensure(kind, obj.id, title)
				if kind == "video":
					entry["video_id"] = getattr(obj, "video_id", "") or ""
				elif kind == "lecture":
					entry["cover_image_url"] = getattr(obj, "cover_image_url", "") or ""
			entry["seconds"] += st.seconds
			m = (st.method or "").upper()
			if m in SECTION_METHODS:
				entry["methods"][m] += st.seconds

	# Merge Feynman sessions time into the same per-source map.
	for key, info in _feynman_seconds_by_source(user).items():
		entry = ensure(key[0], key[1], info["title"])
		entry["feynman_seconds"] += info["seconds"]

	out = sorted(per.values(), key=lambda x: -(x["seconds"] + x["feynman_seconds"]))
	return out


FEYNMAN_ITEM_MODELS = {
	"feynman": ("API", "feynman"),
	"video_feynman": ("VIDEO", "videofeynman"),
	"class_feynman": ("CLASSROOM", "classsessionfeynman"),
}


@api_view(["POST"])
def feynman_session_view(request):
	"""Guardar una sesión Feynman: tiempo + promedio de score (sin SM-2).

	Crea un CoreStudySession (método FEYNMAN) con duración y % promedio, y una
	CoreAttempt por prompt (ai_score + correct umbral) para alimentar stats por
	fuente. NO toca CoreLearningProgress (Feynman tiene su propia evaluación).
	"""
	from datetime import timedelta

	data = request.data
	try:
		seconds = max(0, min(int(data.get("seconds") or 0), 86400))
	except (TypeError, ValueError):
		seconds = 0
	try:
		average = round(float(data.get("average") or 0), 1)
	except (TypeError, ValueError):
		average = 0.0
	threshold = 70
	scores = data.get("scores") or []
	items = len(scores)
	correct = sum(1 for s in scores if (s.get("score") or 0) >= threshold)
	now = timezone.now()

	sess = CoreStudySession.objects.create(
		user=request.user, mode="overall", method="FEYNMAN",
		items_count=items, correct_count=correct,
		percent=average, passed=average >= threshold,
	)
	# started_at is auto_now_add, so backdate via update to reflect true duration.
	CoreStudySession.objects.filter(pk=sess.id).update(
		started_at=now - timedelta(seconds=seconds), ended_at=now
	)

	model = data.get("model") or "feynman"
	if model in FEYNMAN_ITEM_MODELS:
		from CORE.services.srs import record_attempt, quality_from_score
		app_label, model_name = FEYNMAN_ITEM_MODELS[model]
		ct = ContentType.objects.get(app_label=app_label, model=model_name)
		for s in scores:
			oid = s.get("item_id")
			score = s.get("score")
			if oid is None:
				continue
			try:
				ct.get_object_for_this_type(pk=oid)
			except Exception:
				continue
			# Advance the SM-2 schedule for this Feynman prompt (same lifecycle as
			# MCQ/Cloze), using its AI score to drive the schedule.
			record_attempt(
				user=request.user, method="FEYNMAN", content_type_id=ct.id,
				object_id=oid, correct=(score or 0) >= threshold, ai_score=score,
				quality=quality_from_score(score),
			)

	return Response({
		"session_id": sess.id,
		"seconds": seconds,
		"average": average,
		"items": items,
		"correct": correct,
		"passed": sess.passed,
	}, status=201)


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
		ct_id, oid = data.get("content_type_id"), data.get("object_id")
		model_slug = data.get("model")
		if model_slug and model_slug in STUDY_RESOURCE_MODELS:
			app_label, model_name = STUDY_RESOURCE_MODELS[model_slug]
			ct_id = ContentType.objects.get(app_label=app_label, model=model_name).id
			oid = data.get("item_id") or oid
		st = StudyTime.objects.create(
			user=request.user, topic=topic, card=card,
			method=str(data.get("method") or "STUDY"), seconds=seconds,
			content_type_id=ct_id if ct_id else None,
			object_id=oid if oid is not None else None,
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