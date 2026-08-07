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