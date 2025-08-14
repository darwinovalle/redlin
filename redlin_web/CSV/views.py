import csv
from io import TextIOWrapper
from django.db import models
from django.utils import timezone

from rest_framework import status, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response

from API.jwt_auth import JWTAuthentication
from rest_framework.permissions import IsAuthenticated

from .models import CSVImport, CSVFlashcard
from .utils import apply_review
from .serializers import (
	CSVUploadSerializer,
	CSVImportSerializer,
	CSVFlashcardSerializer,
	ReviewSerializer,
)


class CSVImportViewSet(mixins.ListModelMixin,
					   mixins.RetrieveModelMixin,
					   mixins.UpdateModelMixin,
					   mixins.DestroyModelMixin,
					   viewsets.GenericViewSet):
	queryset = CSVImport.objects.all().select_related('user')
	serializer_class = CSVImportSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		# Limit to current user's imports
		user = self.request.user
		return CSVImport.objects.filter(user=user).order_by('-created_at')

	@action(detail=False, methods=['post'], url_path='upload')
	def upload(self, request):
		"""Accepts a CSV and creates flashcards for the authenticated user.

		CSV format (no header required):
		- Column 1: key_term
		- Column 2: definition
		"""
		serializer = CSVUploadSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		file = serializer.validated_data['file']
		# Decode stream under UTF-8 with fallback to latin-1
		try:
			text_stream = TextIOWrapper(file, encoding='utf-8')
			rows = list(csv.reader(text_stream))
		except UnicodeDecodeError:
			file.seek(0)
			text_stream = TextIOWrapper(file, encoding='latin-1')
			rows = list(csv.reader(text_stream))

		# Create import record first
		imp = CSVImport.objects.create(
			user=request.user,
			filename=getattr(file, 'name', 'upload.csv'),
			row_count=0,
		)

		# Heuristic: drop header if it looks like one
		if rows and len(rows[0]) >= 2:
			h0, h1 = rows[0][0].strip().lower(), rows[0][1].strip().lower()
			if h0 in {"keyword", "key", "term", "palabra"} and h1 in {"definition", "definicion", "meaning"}:
				rows = rows[1:]

		created = 0
		for row in rows:
			if not row:
				continue
			key = (row[0] or '').strip()
			definition = (row[1] if len(row) > 1 else '').strip()
			if not key or not definition:
				continue

			# Upsert by (user, source, key_term) so each import has its own set
			card, created_flag = CSVFlashcard.objects.get_or_create(
				user=request.user,
				source=imp,
				key_term=key,
				defaults={
					'definition': definition,
				}
			)
			if not created_flag:
				# If duplicate row inside the same file, update definition and reset SR metrics
				card.definition = definition
				card.status = 'still_learning'
				card.repetitions = 0
				card.interval = 0
				card.easiness = 2.5
				card.next_review_at = None
				card.save()
			else:
				created += 1

		imp.row_count = created
		imp.save(update_fields=['row_count'])

		return Response({
			'import': CSVImportSerializer(imp).data,
			'created': created,
		}, status=status.HTTP_201_CREATED)


class CSVFlashcardViewSet(viewsets.ModelViewSet):
	queryset = CSVFlashcard.objects.all()
	serializer_class = CSVFlashcardSerializer
	authentication_classes = [JWTAuthentication]
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		qs = CSVFlashcard.objects.filter(user=user)
		status_param = self.request.query_params.get('status')
		if status_param:
			qs = qs.filter(status=status_param)
		source_param = self.request.query_params.get('source')
		if source_param:
			try:
				qs = qs.filter(source_id=int(source_param))
			except ValueError:
				pass
		return qs.order_by('next_review_at', 'id')

	@action(detail=True, methods=['post'], url_path='review')
	def review(self, request, pk=None):
		card = self.get_object()
		serializer = ReviewSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		q = serializer.validated_data['quality']  # 0..5


		apply_review(card, q)
		card.save()
		return Response(CSVFlashcardSerializer(card).data)

	@action(detail=False, methods=['get'], url_path='study')
	def study(self, request):
		"""Return a prioritized batch of cards for study.

		Priority: due (next_review_at <= now or null) first, then by lower
		score and fewer times_shown to increase exposure to weak items.
		"""
		limit = request.query_params.get('limit')
		try:
			limit = max(1, min(100, int(limit))) if limit is not None else 20
		except ValueError:
			limit = 20

		now = timezone.now()
		qs = self.get_queryset()

		due = qs.filter(models.Q(next_review_at__isnull=True) | models.Q(next_review_at__lte=now))
		due = due.order_by('next_review_at', 'score', 'times_shown')[:limit]
		remaining = limit - due.count()
		if remaining > 0:
			filler = qs.exclude(id__in=due.values_list('id', flat=True)).order_by('score', 'times_shown')[:remaining]
		else:
			filler = qs.none()

		cards = list(due) + list(filler)
		return Response(CSVFlashcardSerializer(cards, many=True).data)

