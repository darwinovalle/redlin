from rest_framework import viewsets, status
from django.shortcuts import get_object_or_404
from .models import User, Document, Summary, Flashcard, MCQ
from .serializer import UserSerializer, DocumentSerializer, SummarySerializer, FlashcardSerializer, MCQSerializer


from rest_framework.decorators import action
from rest_framework.response import Response

from .task_2 import process_pdf

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from .serializer import LoginSerializer, RegisterSerializer
from .jwt_auth import create_tokens, decode_token
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import BasicAuthentication
from .jwt_auth import JWTAuthentication
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema, OpenApiResponse

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
            'flashcards': FlashcardSerializer(document.flashcards.all(), many=True).data,
            'mcqs': MCQSerializer(document.mcqs.all(), many=True).data
        })

    @action(detail=True, methods=['get'])
    def flashcards(self, request, pk=None):
        document = self.get_object()
        return Response(FlashcardSerializer(document.flashcards.all(), many=True).data)

    @action(detail=True, methods=['get'])
    def mcqs(self, request, pk=None):
        document = self.get_object()
        return Response(MCQSerializer(document.mcqs.all(), many=True).data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        document = self.get_object()
        return Response(SummarySerializer(document.summary).data)

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
        status = self.request.query_params.get('status')
        if status:
            return Flashcard.objects.filter(status=status)
        return super().get_queryset()
    
    @action(detail=False, methods=['get'])
    def still_learning(self, request):
        flashcards = Flashcard.objects.filter(status='still_learning')
        serializer = self.get_serializer(flashcards, many=True)
        return Response(serializer.data)

class MCQViewSet(viewsets.ModelViewSet):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


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
