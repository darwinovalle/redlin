from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .errors import ApiError, ErrorCode, error_response
from .jwt_auth import JWTAuthentication
from .models import Document, DocumentHighlight, FeynmanAttempt, User
from .serializers import (
    ClozeSerializer,
    DocumentHighlightSerializer,
    DocumentSerializer,
    FeynmanAttemptSerializer,
    FeynmanSerializer,
    FlashcardSerializer,
    MCQSerializer,
    SummarySerializer,
    UserSerializer,
)
from .services.document_processing_service import process_pdf
from .services.feynman_service import evaluate_and_record_attempt, get_document_feynman_or_error


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        document = serializer.save()
        try:
            process_pdf(document.id)
        except Exception as exc:
            print(f"Error processing document {document.id} immediately after upload: {exc}")
            document.processing_status = "failed"
            document.save()

    @extend_schema(responses={200: OpenApiResponse(description="PDF stream")})
    @action(detail=True, methods=["get"], url_path="file")
    def file(self, request, pk=None):
        """Stream the original PDF file for this document.

        Security: Only the owner (document.user) can access.
        """
        document = self.get_object()
        if request.user != document.user:
            return HttpResponseForbidden("Not allowed")
        if not document.pdf_file:
            raise Http404("File not found")

        file_handle = None
        try:
            file_handle = document.pdf_file.open("rb")
        except FileNotFoundError:
            fname = Path(document.pdf_file.name).name
            alt_path = Path(settings.BASE_DIR) / "documents" / fname
            if alt_path.exists():
                file_handle = open(alt_path, "rb")
            else:
                raise Http404("File not found")

        response = FileResponse(file_handle, content_type="application/pdf")
        response["Content-Disposition"] = f"inline; filename=\"{document.title or 'document'}.pdf\""
        return response

    @extend_schema(responses={200: OpenApiResponse(description="Document highlights")})
    @action(detail=True, methods=["get", "post"], url_path="highlights")
    def highlights(self, request, pk=None):
        """List or create text highlights for a document (owner only)."""
        document = self.get_object()

        if request.method == "GET":
            qs = document.highlights.filter(user=request.user)
            return Response(DocumentHighlightSerializer(qs, many=True).data)

        serializer = DocumentHighlightSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, document=document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(responses={204: OpenApiResponse(description="Highlight deleted")})
    @action(detail=True, methods=["delete"], url_path=r"highlights/(?P<highlight_pk>[^/.]+)")
    def delete_highlight(self, request, pk=None, highlight_pk=None):
        document = self.get_object()
        highlight = get_object_or_404(
            DocumentHighlight, pk=highlight_pk, document=document, user=request.user
        )
        highlight.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        document = self.get_object()
        if document.processing_status != "pending":
            return error_response(
                ApiError(
                    code=ErrorCode.DOCUMENT_ALREADY_PROCESSED,
                    message="Document already processed or in progress.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    details={"document_id": document.id, "processing_status": document.processing_status},
                )
            )

        process_pdf(document.id)
        return Response({"detail": "Processing started."})

    @action(detail=False, methods=["get"], url_path="user/(?P<user_id>[^/.]+)")
    def get_user_documents(self, request, user_id=None):
        documents = Document.objects.filter(user_id=user_id)
        return Response(self.serializer_class(documents, many=True).data)

    @action(detail=True, methods=["get"])
    def full_details(self, request, pk=None):
        document = self.get_object()
        return Response(
            {
                "document": DocumentSerializer(document).data,
                "summary": SummarySerializer(document.summary).data,
                "flashcards": FlashcardSerializer(
                    document.flashcards.all().order_by("next_review_at", "score", "times_shown", "id"),
                    many=True,
                ).data,
                "mcqs": MCQSerializer(document.mcqs.all(), many=True).data,
                "clozes": ClozeSerializer(document.clozes.all().order_by("-id"), many=True).data,
                "feynman": FeynmanSerializer(document.feynmans.all().order_by("id"), many=True).data,
            }
        )

    @action(detail=True, methods=["get"], url_path="feynman/prompts")
    def feynman_prompts(self, request, pk=None):
        doc = self.get_object()
        qs = doc.feynmans.all().order_by("id")
        return Response(FeynmanSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="feynman/history")
    def feynman_history(self, request, pk=None):
        doc = self.get_object()
        attempts = FeynmanAttempt.objects.filter(document=doc, user=request.user).order_by("-id")
        return Response(FeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=True, methods=["post"], url_path="feynman/evaluate")
    def feynman_evaluate(self, request, pk=None):
        doc = self.get_object()
        try:
            f_obj = get_document_feynman_or_error(doc.id, request.data.get("feynman_id"))
            answer = request.data.get("answer") or ""
            attempt = evaluate_and_record_attempt(f_obj=f_obj, answer=answer, user=request.user)
        except ApiError as api_error:
            return error_response(api_error)
        return Response(FeynmanAttemptSerializer(attempt).data, status=201)

    @action(detail=True, methods=["get"])
    def flashcards(self, request, pk=None):
        document = self.get_object()
        qs = document.flashcards.all().order_by("next_review_at", "score", "times_shown", "id")
        return Response(FlashcardSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def mcqs(self, request, pk=None):
        document = self.get_object()
        return Response(MCQSerializer(document.mcqs.all(), many=True).data)

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        document = self.get_object()
        return Response(SummarySerializer(document.summary).data)

    @action(detail=True, methods=["get"])
    def clozes(self, request, pk=None):
        """List Clozes for a document sub-resource."""
        document = self.get_object()
        qs = document.clozes.all().order_by("-id")
        return Response(ClozeSerializer(qs, many=True).data)


@extend_schema(responses={200: DocumentSerializer(many=True)}, tags=["documents"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_documents(request, user_id):
    documents = Document.objects.filter(user_id=user_id)
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)
