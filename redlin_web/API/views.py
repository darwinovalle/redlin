from rest_framework import viewsets, status
from django.utils import timezone
from django.db import models
from django.shortcuts import get_object_or_404
from .models import User, Document, Summary, Flashcard, MCQ, Cloze, Feynman, FeynmanAttempt
from CORE.models import CoreAttempt
from django.contrib.contenttypes.models import ContentType
import json
from .serializer import (
    UserSerializer, DocumentSerializer, SummarySerializer, FlashcardSerializer, MCQSerializer,
    ReviewSerializer, ClozeSerializer, ClozeGenerateSerializer, ClozeValidateSerializer,
    FeynmanSerializer, FeynmanAttemptSerializer, FeynmanAttemptCreateSerializer
)
from VIDEO.serializers import VideoClozeSerializer
from CORE.services.cloze_generator import ClozeGenerator, VideoClozeGenerator
from VIDEO.models import Video, VideoCloze
from .utils import apply_review


from rest_framework.decorators import action
from rest_framework.response import Response

from .task_2 import process_pdf
from .feynman_ai import evaluate_document_feynman_attempt

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from .serializer import LoginSerializer, RegisterSerializer
from .jwt_auth import create_tokens, decode_token
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import BasicAuthentication
from .jwt_auth import JWTAuthentication
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema, OpenApiResponse
from django.http import FileResponse, HttpResponseForbidden, Http404
from django.conf import settings
from pathlib import Path

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Save the document instance first
        document = serializer.save()
        # Immediately call the processing task
        try:
            # Assuming process_pdf is synchronous for now
            process_pdf(document.id) 
            # Optional: Update status if process_pdf doesn't do it
            # document.processing_status = 'completed' # Or 'processing' if task is async
            # document.save()
        except Exception as e:
            # Handle potential errors during immediate processing
            print(f"Error processing document {document.id} immediately after upload: {e}")
            # Optionally set status to 'failed' or log appropriately
            document.processing_status = 'failed' # Example status
            document.save()

    @extend_schema(responses={200: OpenApiResponse(description='PDF stream')})
    @action(detail=True, methods=['get'], url_path='file')
    def file(self, request, pk=None):
        """Stream the original PDF file for this document.

        Security: Only the owner (document.user) can access.
        """
        document = self.get_object()
        if request.user != document.user:
            return HttpResponseForbidden('Not allowed')
        if not document.pdf_file:
            raise Http404('File not found')

        # Try MEDIA storage first
        file_handle = None
        try:
            file_handle = document.pdf_file.open('rb')
        except FileNotFoundError:
            # Fallback for seeded sample docs located in redlin_web/documents/
            # Use the filename part only and look in BASE_DIR/documents
            fname = Path(document.pdf_file.name).name
            alt_path = Path(settings.BASE_DIR) / 'documents' / fname
            if alt_path.exists():
                file_handle = open(alt_path, 'rb')
            else:
                raise Http404('File not found')

        response = FileResponse(file_handle, content_type='application/pdf')
        # Force a stable filename for downloads if user saves it
        response["Content-Disposition"] = f"inline; filename=\"{document.title or 'document'}.pdf\""
        return response

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        document = self.get_object()
        if document.processing_status != 'pending':
            return Response({"detail": "Document already processed or in progress."}, status=400)

        process_pdf(document.id)  # Run the task (can integrate Celery for async processing)
        return Response({"detail": "Processing started."})
    
    @action(detail=False, methods=['get'], url_path='user/(?P<user_id>[^/.]+)')
    def get_user_documents(self, request, user_id=None):
        documents = Document.objects.filter(user_id=user_id)
        return Response(self.serializer_class(documents, many=True).data)

    @action(detail=True, methods=['get'])
    def full_details(self, request, pk=None):
        document = self.get_object()
        return Response({
            'document': DocumentSerializer(document).data,
            'summary': SummarySerializer(document.summary).data,
            # Order flashcards by review priority so consumers get a consistent ordering
            'flashcards': FlashcardSerializer(
                document.flashcards.all().order_by('next_review_at', 'score', 'times_shown', 'id'),
                many=True
            ).data,
            'mcqs': MCQSerializer(document.mcqs.all(), many=True).data,
            'clozes': ClozeSerializer(document.clozes.all().order_by('-id'), many=True).data,
            'feynman': FeynmanSerializer(document.feynmans.all().order_by('id'), many=True).data,
        })

    # ---------------- Feynman Nested Endpoints (Issue #14) ----------------
    @action(detail=True, methods=['get'], url_path='feynman/prompts')
    def feynman_prompts(self, request, pk=None):
        doc = self.get_object()
        qs = doc.feynmans.all().order_by('id')
        return Response(FeynmanSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='feynman/history')
    def feynman_history(self, request, pk=None):
        doc = self.get_object()
        attempts = FeynmanAttempt.objects.filter(document=doc, user=request.user).order_by('-id')
        return Response(FeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=True, methods=['post'], url_path='feynman/evaluate')
    def feynman_evaluate(self, request, pk=None):
        doc = self.get_object()
        feynman_id = request.data.get('feynman_id')
        answer = request.data.get('answer') or ''
        if not feynman_id:
            return Response({'detail':'feynman_id requerido'}, status=400)
        try:
            fid = int(feynman_id)
        except ValueError:
            return Response({'detail':'feynman_id inválido'}, status=400)
        f_obj = Feynman.objects.filter(id=fid, document=doc).first()
        if not f_obj:
            return Response({'detail':'Feynman no encontrado'}, status=404)
        attempt = evaluate_document_feynman_attempt(f_obj, answer, request.user)
        # Registrar en CoreAttempt
        try:
            ct = ContentType.objects.get_for_model(FeynmanAttempt)
            CoreAttempt.objects.create(
                user=request.user,
                method='FEYNMAN',
                content_type=ct,
                object_id=attempt.id,
                raw_answer=attempt.answer_text,
                ai_score=attempt.score,
                ai_feedback=attempt.breakdown or {},
                correct=(attempt.score or 0) >= 60,
            )
        except Exception as e:
            print(f"[CoreAttempt] Error creando registro: {e}")
        return Response(FeynmanAttemptSerializer(attempt).data, status=201)

    @action(detail=True, methods=['get'])
    def flashcards(self, request, pk=None):
        document = self.get_object()
        # Return flashcards ordered by priority: due first (next_review_at null or earlier),
        # then lower score and fewer times_shown to surface weaker items.
        qs = document.flashcards.all().order_by('next_review_at', 'score', 'times_shown', 'id')
        return Response(FlashcardSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def mcqs(self, request, pk=None):
        document = self.get_object()
        return Response(MCQSerializer(document.mcqs.all(), many=True).data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        document = self.get_object()
        return Response(SummarySerializer(document.summary).data)

    @action(detail=True, methods=['get'])
    def clozes(self, request, pk=None):
        """Listar Clozes del documento (sub-recurso consistente con flashcards/mcqs/summary)."""
        document = self.get_object()
        qs = document.clozes.all().order_by('-id')
        return Response(ClozeSerializer(qs, many=True).data)

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
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        document_param = self.request.query_params.get('document')
        if document_param:
            try:
                qs = qs.filter(document_id=int(document_param))
            except ValueError:
                pass
        return qs
    
    @action(detail=False, methods=['get'])
    def still_learning(self, request):
        flashcards = self.get_queryset().filter(status='still_learning')
        serializer = self.get_serializer(flashcards, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        card = self.get_object()
        serializer = ReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        q = serializer.validated_data['quality']  # 0..5

        apply_review(card, q)
        card.save()
        return Response(self.get_serializer(card).data)

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
        return Response(self.get_serializer(cards, many=True).data)

class MCQViewSet(viewsets.ModelViewSet):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


class ClozeViewSet(viewsets.ReadOnlyModelViewSet):
    """List & generate Cloze items for Documents or Videos.

    Acciones:
      - list: /api/cloze/ (filtros opcionales por document, video, difficulty)
      - POST /api/cloze/generate/ {document|video, max_items}
      - POST /api/cloze/validate/ {cloze, answer}
    """
    queryset = Cloze.objects.all().order_by('-id')
    serializer_class = ClozeSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Base queryset for Document-based clozes only.

        Nota: El filtrado por video se maneja en list() porque mezcla modelos.
        """
        qs = Cloze.objects.filter(document__user=self.request.user).order_by('-id')
        document_id = self.request.query_params.get('document')
        if document_id:
            try:
                qs = qs.filter(document_id=int(document_id))
            except ValueError:
                pass
        difficulty = self.request.query_params.get('difficulty')
        if difficulty in {'easy','medium','hard'}:
            qs = qs.filter(difficulty=difficulty)
        return qs

    def list(self, request, *args, **kwargs):  # override para soportar video
        video_id = request.query_params.get('video')
        difficulty = request.query_params.get('difficulty')
        if video_id:
            # List video clozes (solo VideoCloze)
            try:
                vid = int(video_id)
            except ValueError:
                return Response([], status=200)
            vqs = VideoCloze.objects.filter(video__user=request.user, video_id=vid).order_by('-id')
            if difficulty in {'easy','medium','hard'}:
                vqs = vqs.filter(difficulty=difficulty)
            data = VideoClozeSerializer(vqs, many=True).data
            return Response(data)
        # Default: document clozes
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        serializer = ClozeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        max_items = data.get('max_items', 6)
        created = []
        if data.get('document'):
            doc = get_object_or_404(Document, pk=data['document'], user=request.user)
            gen = ClozeGenerator(doc, max_items=max_items)
            created = gen.generate()
            return Response(ClozeSerializer(created, many=True).data, status=201)
        else:
            video = get_object_or_404(Video, pk=data['video'], user=request.user)
            vgen = VideoClozeGenerator(video, max_items=max_items)
            v_created = vgen.generate()
            return Response(VideoClozeSerializer(v_created, many=True).data, status=201)

    @action(detail=False, methods=['post'])
    def validate(self, request):
        """Validate a Cloze or VideoCloze answer (explicit type required)."""
        serializer = ClozeValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cloze_id = serializer.validated_data['cloze_id']
        answer = serializer.validated_data['answer']
        ctype = serializer.validated_data['cloze_type']

        def _cmp(expected: str, provided: str) -> bool:
            return expected.strip().lower() == provided.strip().lower()

        if ctype == 'document':
            obj = Cloze.objects.filter(id=cloze_id, document__user=request.user).first()
            if not obj:
                return Response({'detail': 'Cloze no encontrado'}, status=404)
            return Response({'cloze_id': obj.id, 'correct': _cmp(obj.answer, answer), 'type': 'document'})
        # ctype == 'video'
        vobj = VideoCloze.objects.filter(id=cloze_id, video__user=request.user).first()
        if not vobj:
            return Response({'detail': 'Cloze no encontrado'}, status=404)
        return Response({'cloze_id': vobj.id, 'correct': _cmp(vobj.answer, answer), 'type': 'video'})


class FeynmanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Feynman.objects.all().order_by('id')
    serializer_class = FeynmanSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Feynman.objects.filter(document__user=self.request.user).order_by('id')
        document_id = self.request.query_params.get('document')
        if document_id:
            try:
                qs = qs.filter(document_id=int(document_id))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=['get'])
    def attempts(self, request):
        f_id = request.query_params.get('feynman')
        if not f_id:
            return Response([], status=200)
        try:
            fid = int(f_id)
        except ValueError:
            return Response({'detail': 'id inválido'}, status=400)
        attempts = FeynmanAttempt.objects.filter(feynman__id=fid, user=request.user).order_by('-id')
        return Response(FeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=False, methods=['post'])
    def attempt(self, request):
        serializer = FeynmanAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        f_id = serializer.validated_data['feynman_id']
        answer = serializer.validated_data['answer']
        f_obj = Feynman.objects.filter(id=f_id, document__user=request.user).first()
        if not f_obj:
            return Response({'detail': 'Feynman no encontrado'}, status=404)
        attempt = evaluate_document_feynman_attempt(f_obj, answer, request.user)
        # CoreAttempt registro
        try:
            ct = ContentType.objects.get_for_model(FeynmanAttempt)
            CoreAttempt.objects.create(
                user=request.user,
                method='FEYNMAN',
                content_type=ct,
                object_id=attempt.id,
                raw_answer=attempt.answer_text,
                ai_score=attempt.score,
                ai_feedback=attempt.breakdown or {},
                correct=(attempt.score or 0) >= 60,
            )
        except Exception as e:
            print(f"[CoreAttempt] Error creando registro: {e}")
        return Response(FeynmanAttemptSerializer(attempt).data, status=201)


@extend_schema(
    request=LoginSerializer,
    responses={
        200: {
            'type': 'object',
            'properties': {
                'id': {'type': 'integer'},
                'username': {'type': 'string'},
                'email': {'type': 'string'},
                'access': {'type': 'string'},
                'refresh': {'type': 'string'},
            },
            'required': ['id', 'username', 'email', 'access', 'refresh']
        },
        401: OpenApiResponse(description='Invalid credentials')
    },
    tags=['auth'],
    auth=[]
)
@csrf_exempt
@api_view(['POST'])
@permission_classes([])
@authentication_classes([])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(username=username, password=password)
            access, refresh = create_tokens(user.id)
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'access': access,
                'refresh': refresh,
            })
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    request=RegisterSerializer,
    responses={
        201: {
            'type': 'object',
            'properties': {
                'id': {'type': 'integer'},
                'username': {'type': 'string'},
                'email': {'type': 'string'},
                'access': {'type': 'string'},
                'refresh': {'type': 'string'},
            },
            'required': ['id', 'username', 'email', 'access', 'refresh']
        },
        400: OpenApiResponse(description='Invalid data')
    },
    tags=['auth'],
    auth=[]
)
@csrf_exempt
@api_view(['POST'])
@permission_classes([])
@authentication_classes([])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        access, refresh = create_tokens(user.id)
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'access': access,
            'refresh': refresh,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    request={'application/json': {
        'type': 'object',
        'properties': {'refresh': {'type': 'string'}},
        'required': ['refresh'],
    }},
    responses={200: {'type': 'object', 'properties': {'access': {'type': 'string'}, 'refresh': {'type': 'string'}}}},
    tags=['auth'],
    auth=[]
)
@csrf_exempt
@api_view(['POST'])
@permission_classes([])
@authentication_classes([])
def refresh_token(request):
    token = request.data.get('refresh')
    if not token:
        return Response({'error': 'Refresh token required'}, status=400)
    try:
        payload = decode_token(token, expected_type='refresh')
        user_id = payload.get('sub')
        access, refresh = create_tokens(user_id)
        return Response({'access': access, 'refresh': refresh})
    except Exception as e:
        return Response({'error': str(e)}, status=401)


@extend_schema(
    responses={200: {'type': 'object', 'properties': {'sub': {'type': 'string'}, 'type': {'type': 'string'}}}},
    tags=['auth'],
    auth=[]
)
@api_view(['GET'])
@permission_classes([])
@authentication_classes([])
def whoami(request):
    # Reads Authorization header and returns the user id if valid
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return Response({'error': 'Missing bearer token'}, status=401)
    token = auth.split(' ', 1)[1]
    try:
        payload = decode_token(token, expected_type='access')
        return Response({'sub': payload.get('sub'), 'type': payload.get('type')})
    except Exception as e:
        return Response({'error': str(e)}, status=401)

@extend_schema(responses={200: DocumentSerializer(many=True)}, tags=['documents'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_documents(request, user_id):
    try:
        documents = Document.objects.filter(user_id=user_id)
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response(
            {'error': 'Could not fetch documents'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
