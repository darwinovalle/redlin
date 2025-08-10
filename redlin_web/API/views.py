from rest_framework import viewsets, status
from django.shortcuts import get_object_or_404
from .models import User, Document, Summary, Flashcard, MCQ
from .serializer import UserSerializer, DocumentSerializer, SummarySerializer, FlashcardSerializer, MCQSerializer


from rest_framework.decorators import action
from rest_framework.response import Response

from .task_2 import process_pdf

from rest_framework.decorators import api_view
from .serializer import LoginSerializer, RegisterSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer

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

class FlashcardViewSet(viewsets.ModelViewSet):
    queryset = Flashcard.objects.all()
    serializer_class = FlashcardSerializer

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


@api_view(['POST'])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(username=username, password=password)
            return Response({
                'id': user.id,
                'username': user.username,
                'email': user.email
            })
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
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
