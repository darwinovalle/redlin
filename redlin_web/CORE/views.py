from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Space
from .serializers import SpaceSerializer
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

