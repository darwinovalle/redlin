import json
from pathlib import Path

try:
    import fitz  # PyMuPDF — renders PDF pages to images for cover thumbnails
except ImportError:
    import pymupdf as fitz

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, HttpResponseForbidden
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
from .tasks import process_pdf_task


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
        # Books are containers and chapters are created via the book endpoint,
        # so only regular documents auto-process on create.
        if document.kind != Document.KIND_DOCUMENT:
            return
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
        # A Book chapter reuses its parent book's PDF file.
        source = document.source_document
        if not source.pdf_file:
            raise Http404("File not found")

        file_handle = None
        try:
            file_handle = source.pdf_file.open("rb")
        except FileNotFoundError:
            fname = Path(source.pdf_file.name).name
            alt_path = Path(settings.BASE_DIR) / "documents" / fname
            if alt_path.exists():
                file_handle = open(alt_path, "rb")
            else:
                raise Http404("File not found")

        response = FileResponse(file_handle, content_type="application/pdf")
        response["Content-Disposition"] = f"inline; filename=\"{source.title or 'document'}.pdf\""
        return response

    @extend_schema(responses={200: OpenApiResponse(description="Book cover thumbnail (JPEG)")})
    @action(detail=True, methods=["get"], url_path="cover")
    def cover(self, request, pk=None):
        """Render the first page of the document's PDF as a small JPEG cover.

        Used by the Books grid so each card can show the book's cover as a
        lightweight image instead of the frontend downloading the whole PDF.
        """
        document = self.get_object()
        if request.user != document.user:
            return HttpResponseForbidden("Not allowed")
        # A Book chapter reuses its parent book's PDF file.
        source = document.source_document
        if not source.pdf_file:
            raise Http404("File not found")

        file_handle = None
        try:
            file_handle = source.pdf_file.open("rb")
        except FileNotFoundError:
            fname = Path(source.pdf_file.name).name
            alt_path = Path(settings.BASE_DIR) / "documents" / fname
            if alt_path.exists():
                file_handle = open(alt_path, "rb")
            else:
                raise Http404("File not found")

        try:
            doc = fitz.open(stream=file_handle.read(), filetype="pdf")
            page = doc.load_page(0)
            # Aim for a ~480px-wide strip, plenty for a ~300px card cover.
            zoom = 480 / page.rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            data = pix.tobytes("jpeg", jpg_quality=82)
        except Exception:
            raise Http404("Could not render cover")
        finally:
            doc.close()
            if file_handle:
                file_handle.close()

        response = HttpResponse(data, content_type="image/jpeg")
        response["Cache-Control"] = "public, max-age=86400"
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
                "summary": SummarySerializer(document.summary).data if hasattr(document, "summary") else None,
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
        # Freshly added documents have no Summary row yet (async generation);
        # return null instead of raising RelatedObjectDoesNotExist.
        if not hasattr(document, "summary"):
            return Response(None)
        return Response(SummarySerializer(document.summary).data)

    @action(detail=True, methods=["get"])
    def clozes(self, request, pk=None):
        """List Clozes for a document sub-resource (paginated)."""
        document = self.get_object()
        qs = document.clozes.all().order_by("-id")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(ClozeSerializer(page, many=True).data)
        return Response(ClozeSerializer(qs, many=True).data)

    @extend_schema(responses={200: OpenApiResponse(description="Books")})
    @action(detail=False, methods=["get", "post"], url_path="books")
    def books(self, request):
        """List books (with chapters) or create a book + its chapters."""
        if request.method == "GET":
            books = Document.objects.filter(user=request.user, kind=Document.KIND_BOOK).order_by("-upload_date")
            data = []
            for book in books:
                chapters = book.chapters.filter(user=request.user).order_by("page_start")
                data.append({
                    "id": book.id,
                    "title": book.title,
                    "upload_date": book.upload_date,
                    "total_pages": (book.source_meta or {}).get("total_pages"),
                    "chapters": [
                        {
                            "id": ch.id,
                            "title": ch.title,
                            "page_start": ch.page_start,
                            "page_end": ch.page_end,
                            "processing_status": ch.processing_status,
                        }
                        for ch in chapters
                    ],
                })
            return Response(data)

        title = (request.data.get("title") or "").strip()
        pdf_file = request.FILES.get("pdf_file")
        if not title or not pdf_file:
            return Response({"detail": "title and pdf_file are required."}, status=status.HTTP_400_BAD_REQUEST)
        chapters_json = request.data.get("chapters_json", "[]")
        try:
            chapters_defs = json.loads(chapters_json) if isinstance(chapters_json, str) else chapters_json
        except json.JSONDecodeError:
            return Response({"detail": "chapters_json must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total_pages = int(request.data.get("total_pages") or 0)
        except (TypeError, ValueError):
            total_pages = 0
        book = Document.objects.create(
            user=request.user,
            title=title,
            pdf_file=pdf_file,
            kind=Document.KIND_BOOK,
            processing_status="completed",  # a book is a container; chapters carry the study items
            source_meta={"total_pages": total_pages} if total_pages else {},
        )
        created = []
        for index, ch in enumerate(chapters_defs):
            c_title = str(ch.get("title") or "").strip() or f"Chapter {index + 1}"
            page_start = int(ch.get("page_start") or 1)
            page_end = ch.get("page_end")
            page_end = int(page_end) if page_end else None
            chapter = Document.objects.create(
                user=request.user,
                title=c_title,
                kind=Document.KIND_CHAPTER,
                parent=book,
                page_start=page_start,
                page_end=page_end,
                processing_status="pending",
            )
            process_pdf_task.delay(chapter.id, chapter.page_start, chapter.page_end)
            created.append({
                "id": chapter.id,
                "title": chapter.title,
                "page_start": chapter.page_start,
                "page_end": chapter.page_end,
                "processing_status": chapter.processing_status,
            })
        return Response({"id": book.id, "title": book.title, "chapters": created}, status=status.HTTP_201_CREATED)

    @extend_schema(responses={200: OpenApiResponse(description="Book chapters")})
    @action(detail=True, methods=["get", "post"], url_path="chapters")
    def chapters(self, request, pk=None):
        """Return a book's chapters, or add new chapters to an existing book."""
        book = self.get_object()
        if request.method == "POST":
            if book.kind != Document.KIND_BOOK:
                return Response({"detail": "Only books can have chapters."}, status=status.HTTP_400_BAD_REQUEST)
            chapters_defs = request.data.get("chapters") or request.data.get("chapters_json") or []
            if isinstance(chapters_defs, str):
                try:
                    chapters_defs = json.loads(chapters_defs)
                except json.JSONDecodeError:
                    return Response({"detail": "chapters must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(chapters_defs, list) or not chapters_defs:
                return Response({"detail": "chapters must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
            created = []
            for index, ch in enumerate(chapters_defs):
                c_title = str(ch.get("title") or "").strip() or f"Chapter {book.chapters.count() + index + 1}"
                page_start = int(ch.get("page_start") or 1)
                page_end = ch.get("page_end")
                page_end = int(page_end) if page_end else None
                chapter = Document.objects.create(
                    user=request.user,
                    title=c_title,
                    kind=Document.KIND_CHAPTER,
                    parent=book,
                    page_start=page_start,
                    page_end=page_end,
                    processing_status="pending",
                )
                process_pdf_task.delay(chapter.id, chapter.page_start, chapter.page_end)
                created.append({
                    "id": chapter.id,
                    "title": chapter.title,
                    "page_start": chapter.page_start,
                    "page_end": chapter.page_end,
                    "processing_status": chapter.processing_status,
                })
            return Response(created, status=status.HTTP_201_CREATED)

        chapters = book.chapters.filter(user=request.user).order_by("page_start")
        return Response([
            {
                "id": ch.id,
                "title": ch.title,
                "page_start": ch.page_start,
                "page_end": ch.page_end,
                "processing_status": ch.processing_status,
            }
            for ch in chapters
        ])


@extend_schema(responses={200: DocumentSerializer(many=True)}, tags=["documents"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_documents(request, user_id):
    # Only regular study documents appear in "Study Documents" — books and
    # chapters live under the Books section.
    documents = Document.objects.filter(user_id=user_id, kind=Document.KIND_DOCUMENT)
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)
