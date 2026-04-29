from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from CORE.services.cloze_generator import ClozeGenerator, VideoClozeGenerator
from VIDEO.models import Video, VideoCloze
from VIDEO.serializers import VideoClozeSerializer

from .errors import ApiError, ErrorCode, error_response
from .jwt_auth import JWTAuthentication
from .models import Cloze, Document, Flashcard, Feynman, FeynmanAttempt, MCQ, Summary
from .serializers import (
    ClozeGenerateSerializer,
    ClozeSerializer,
    ClozeValidateSerializer,
    FeynmanAttemptCreateSerializer,
    FeynmanAttemptSerializer,
    FeynmanSerializer,
    FlashcardSerializer,
    MCQSerializer,
    ReviewSerializer,
    SummarySerializer,
)
from .services.feynman_service import evaluate_and_record_attempt, get_owned_feynman_or_error, parse_feynman_id
from .utils import apply_review


class SummaryViewSet(viewsets.ModelViewSet):
    queryset = Summary.objects.all()
    serializer_class = SummarySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


class FlashcardViewSet(viewsets.ModelViewSet):
    queryset = Flashcard.objects.all()
    serializer_class = FlashcardSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Flashcard.objects.filter(document__user=user)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        document_param = self.request.query_params.get("document")
        if document_param:
            try:
                qs = qs.filter(document_id=int(document_param))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=["get"])
    def still_learning(self, request):
        flashcards = self.get_queryset().filter(status="still_learning")
        serializer = self.get_serializer(flashcards, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        card = self.get_object()
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quality = serializer.validated_data["quality"]

        apply_review(card, quality)
        card.save()
        return Response(self.get_serializer(card).data)

    @action(detail=False, methods=["get"], url_path="study")
    def study(self, request):
        """Return a prioritized batch of cards for study."""
        limit = request.query_params.get("limit")
        try:
            limit = max(1, min(100, int(limit))) if limit is not None else 20
        except ValueError:
            limit = 20

        now = timezone.now()
        qs = self.get_queryset()

        due = qs.filter(models.Q(next_review_at__isnull=True) | models.Q(next_review_at__lte=now))
        due = due.order_by("next_review_at", "score", "times_shown")[:limit]
        remaining = limit - due.count()
        if remaining > 0:
            filler = qs.exclude(id__in=due.values_list("id", flat=True)).order_by("score", "times_shown")[:remaining]
        else:
            filler = qs.none()

        cards = list(due) + list(filler)
        return Response(self.get_serializer(cards, many=True).data)


class MCQViewSet(viewsets.ModelViewSet):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


class ClozeViewSet(viewsets.ReadOnlyModelViewSet):
    """List and generate Cloze items for Documents or Videos."""

    queryset = Cloze.objects.all().order_by("-id")
    serializer_class = ClozeSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Cloze.objects.filter(document__user=self.request.user).order_by("-id")
        document_id = self.request.query_params.get("document")
        if document_id:
            try:
                qs = qs.filter(document_id=int(document_id))
            except ValueError:
                pass
        difficulty = self.request.query_params.get("difficulty")
        if difficulty in {"easy", "medium", "hard"}:
            qs = qs.filter(difficulty=difficulty)
        return qs

    def list(self, request, *args, **kwargs):
        video_id = request.query_params.get("video")
        difficulty = request.query_params.get("difficulty")
        if video_id:
            try:
                vid = int(video_id)
            except ValueError:
                return Response([], status=200)
            vqs = VideoCloze.objects.filter(video__user=request.user, video_id=vid).order_by("-id")
            if difficulty in {"easy", "medium", "hard"}:
                vqs = vqs.filter(difficulty=difficulty)
            data = VideoClozeSerializer(vqs, many=True).data
            return Response(data)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = ClozeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        max_items = data.get("max_items", 6)
        if data.get("document"):
            doc = get_object_or_404(Document, pk=data["document"], user=request.user)
            generator = ClozeGenerator(doc, max_items=max_items)
            created = generator.generate()
            return Response(ClozeSerializer(created, many=True).data, status=201)

        video = get_object_or_404(Video, pk=data["video"], user=request.user)
        video_generator = VideoClozeGenerator(video, max_items=max_items)
        created = video_generator.generate()
        return Response(VideoClozeSerializer(created, many=True).data, status=201)

    @action(detail=False, methods=["post"])
    def validate(self, request):
        serializer = ClozeValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cloze_id = serializer.validated_data["cloze_id"]
        answer = serializer.validated_data["answer"]
        cloze_type = serializer.validated_data["cloze_type"]

        def _cmp(expected: str, provided: str) -> bool:
            return expected.strip().lower() == provided.strip().lower()

        if cloze_type == "document":
            obj = Cloze.objects.filter(id=cloze_id, document__user=request.user).first()
            if not obj:
                return error_response(
                    ApiError(
                        code=ErrorCode.CLOZE_NOT_FOUND,
                        message="Cloze no encontrado",
                        status_code=status.HTTP_404_NOT_FOUND,
                        details={"cloze_id": cloze_id, "cloze_type": "document"},
                    )
                )
            return Response({"cloze_id": obj.id, "correct": _cmp(obj.answer, answer), "type": "document"})

        vobj = VideoCloze.objects.filter(id=cloze_id, video__user=request.user).first()
        if not vobj:
            return error_response(
                ApiError(
                    code=ErrorCode.CLOZE_NOT_FOUND,
                    message="Cloze no encontrado",
                    status_code=status.HTTP_404_NOT_FOUND,
                    details={"cloze_id": cloze_id, "cloze_type": "video"},
                )
            )
        return Response({"cloze_id": vobj.id, "correct": _cmp(vobj.answer, answer), "type": "video"})


class FeynmanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Feynman.objects.all().order_by("id")
    serializer_class = FeynmanSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Feynman.objects.filter(document__user=self.request.user).order_by("id")
        document_id = self.request.query_params.get("document")
        if document_id:
            try:
                qs = qs.filter(document_id=int(document_id))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=["get"])
    def attempts(self, request):
        f_id = request.query_params.get("feynman")
        if not f_id:
            return Response([], status=200)
        try:
            fid = parse_feynman_id(f_id)
        except ApiError as api_error:
            return error_response(api_error)
        attempts = FeynmanAttempt.objects.filter(feynman__id=fid, user=request.user).order_by("-id")
        return Response(FeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=False, methods=["post"])
    def attempt(self, request):
        serializer = FeynmanAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        f_id = serializer.validated_data["feynman_id"]
        answer = serializer.validated_data["answer"]
        try:
            f_obj = get_owned_feynman_or_error(request.user, f_id)
            attempt = evaluate_and_record_attempt(f_obj=f_obj, answer=answer, user=request.user)
        except ApiError as api_error:
            return error_response(api_error)
        return Response(FeynmanAttemptSerializer(attempt).data, status=201)
