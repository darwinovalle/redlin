from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from API.jwt_auth import JWTAuthentication
from API.models import Document
from API.serializers import DocumentSerializer

from .models import (
    ClassSession,
    ClassSessionSummary,
    ClassSessionMCQ,
    ClassSessionCloze,
    ClassSessionFeynman,
    ClassSessionFeynmanAttempt,
)
from .serializers import (
    ClassSessionFinishSerializer,
    ClassSessionSerializer,
    ClassSessionStartSerializer,
    ClassSessionUploadAudioSerializer,
    ClassSessionSummarySerializer,
    ClassSessionMCQSerializer,
    ClassSessionClozeSerializer,
    ClassSessionFeynmanSerializer,
    ClassSessionFeynmanAttemptSerializer,
)
from .services.feynman_service import evaluate_and_record_attempt
from API.serializer import FeynmanAttemptCreateSerializer
from .tasks import process_class_session_task, transcribe_class_session_task


class ClassSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ClassSessionSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClassSession.objects.filter(user=self.request.user).order_by("-created_at")

    def list(self, request, *args, **kwargs):
        """Custom list to ensure consistency with VideoViewSet and provide debug logging."""
        qs = self.get_queryset()
        out = []
        for s in qs:
            try:
                out.append({
                    'id': s.id,
                    'title': s.title,
                    'status': s.status,
                    'language': s.language,
                    'cover_image_url': request.build_absolute_uri(s.cover_image.url) if s.cover_image else None,
                    'created_at': s.created_at,
                    'updated_at': s.updated_at,
                })
            except Exception as e:
                print(f"[ClassSession list error] session {getattr(s, 'id', '?')}: {e}")
        return Response(out)

    @action(detail=False, methods=["post"], url_path="start")
    def start(self, request):
        serializer = ClassSessionStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        title = serializer.validated_data.get("title", "").strip()
        if not title:
            return Response({"detail": "Title is required to start a session."}, status=status.HTTP_400_BAD_REQUEST)

        session = ClassSession.objects.create(
            user=request.user,
            title=title,
            language=serializer.validated_data.get("language", "es") or "es",
            # Start neutral: the session exists but is not "recording" until the
            # client actually starts capture and delivers audio.
            status=ClassSession.STATUS_NEW,
        )
        return Response(ClassSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cover")
    def cover(self, request, pk=None):
        """Set the card cover image for a classroom space (owner only)."""
        session = self.get_object()
        cover = request.FILES.get("cover_image")
        if not cover:
            return Response({"detail": "cover_image is required."}, status=status.HTTP_400_BAD_REQUEST)
        session.cover_image = cover
        session.save(update_fields=["cover_image"])
        return Response(ClassSessionSerializer(session, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="stop")
    def stop(self, request, pk=None):
        session = self.get_object()
        # A session can be stopped when it was never captured (new) or while a
        # capture was active (recording). Stopping an already-stopped/idle/finished
        # session is harmless and treated as a no-op for idempotency.
        if session.status not in (
            ClassSession.STATUS_NEW,
            ClassSession.STATUS_RECORDING,
            ClassSession.STATUS_STOPPED,
        ):
            return Response({"detail": f"Cannot stop session in status {session.status}"}, status=status.HTTP_400_BAD_REQUEST)

        session.status = ClassSession.STATUS_STOPPED
        session.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Session stopped."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="upload-audio")
    def upload_audio(self, request, pk=None):
        session = self.get_object()
        serializer = ClassSessionUploadAudioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session.audio_file = serializer.validated_data["audio_file"]
        session.save(update_fields=["audio_file", "updated_at"])
        return Response({"detail": "Audio uploaded."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        session = self.get_object()
        serializer = ClassSessionFinishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transcript_text = serializer.validated_data.get("transcript_text", "").strip()
        if transcript_text:
            session.transcript_text = transcript_text
            session.status = ClassSession.STATUS_READY
            session.error_message = ""
            session.save(update_fields=["transcript_text", "status", "error_message", "updated_at"])
            process_class_session_task.delay(session.id)
            return Response({"detail": "Manual transcript accepted. Processing queued."}, status=202)

        if not session.audio_file:
            return Response({"detail": "Provide transcript_text or upload audio first."}, status=400)

        # Explicitly transition to transcribing status before queuing the task
        session.status = ClassSession.STATUS_TRANSCRIBING
        session.error_message = ""
        session.save(update_fields=["status", "error_message", "updated_at"])

        transcribe_class_session_task.delay(session.id)
        return Response({"detail": "Transcription and processing queued."}, status=202)

    @action(detail=True, methods=["get"], url_path="status")
    def session_status(self, request, pk=None):
        session = self.get_object()
        return Response(
            {
                "id": session.id,
                "title": session.title,
                "language":session.language,
                "status": session.status,
                "error_message": session.error_message,
                "linked_document": session.linked_document_id,
                "updated_at": session.updated_at,
            }
        )

    @action(detail=True, methods=["get"], url_path="results")
    def results(self, request, pk=None):
        session = self.get_object()

        return Response(
            {
                "session": ClassSessionSerializer(session).data,
                "document": DocumentSerializer(session.linked_document).data if session.linked_document else None,
                "summary": ClassSessionSummarySerializer(session.summary).data if hasattr(session, "summary") else None,
                "mcqs": ClassSessionMCQSerializer(session.mcqs.all(), many=True).data,
                "clozes": ClassSessionClozeSerializer(session.clozes.all().order_by("-id"), many=True).data,
                "feynmans": ClassSessionFeynmanSerializer(session.feynmans.all().order_by("id"), many=True).data,
            }
        )

    @action(detail=True, methods=["get"], url_path="feynman/prompts")
    def feynman_prompts(self, request, pk=None):
        session = self.get_object()
        qs = session.feynmans.all().order_by("id")
        return Response(ClassSessionFeynmanSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="feynman/history")
    def feynman_history(self, request, pk=None):
        session = self.get_object()
        attempts = session.feynman_attempts.filter(user=request.user).order_by("-id")
        return Response(ClassSessionFeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=True, methods=["post"], url_path="feynman/evaluate")
    def feynman_evaluate(self, request, pk=None):
        session = self.get_object()
        serializer = FeynmanAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feynman_id = serializer.validated_data["feynman_id"]
        answer = serializer.validated_data["answer"]
        f_obj = session.feynmans.filter(id=feynman_id).first()
        if not f_obj:
            return Response({"detail": "Feynman not found"}, status=status.HTTP_404_NOT_FOUND)

        attempt = evaluate_and_record_attempt(f_obj=f_obj, answer=answer, user=request.user)
        return Response(ClassSessionFeynmanAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)
    
class ClassSessionSummaryViewSet(viewsets.ReadOnlyModelViewSet):
      queryset = ClassSessionSummary.objects.all()                                                                                                            
      serializer_class = ClassSessionSummarySerializer
      authentication_classes = [JWTAuthentication]                                                                                                            
      permission_classes = [IsAuthenticated]                                                                                                                  
                                                                                                                                                              
      def get_queryset(self):                                                                                                                                 
          return ClassSessionSummary.objects.filter(class_session__user=self.request.user)                                                                    
                                                                                                                                                              
                                                                                                                                                              
class ClassSessionMCQViewSet(viewsets.ReadOnlyModelViewSet):                                                                                                
    queryset = ClassSessionMCQ.objects.all()                                                                                                                
    serializer_class = ClassSessionMCQSerializer                                                                                                            
    authentication_classes = [JWTAuthentication]                                                                                                            
    permission_classes = [IsAuthenticated]                                                                                                                  
                                                                                                                                                            
    def get_queryset(self):                                                                                                                                 
        return ClassSessionMCQ.objects.filter(class_session__user=self.request.user)                                                                        
                                                                                                                                                            
                                                                                                                                                            
class ClassSessionClozeViewSet(viewsets.ReadOnlyModelViewSet):                                                                                              
    queryset = ClassSessionCloze.objects.all().order_by("-id")                                                                                              
    serializer_class = ClassSessionClozeSerializer                                                                                                          
    authentication_classes = [JWTAuthentication]                                                                                                            
    permission_classes = [IsAuthenticated]                                                                                                                  
                                                                                                                                                            
    def get_queryset(self):                                                                                                                                 
        return ClassSessionCloze.objects.filter(class_session__user=self.request.user).order_by("-id")                                                      
                                                                                                                                                            
                                                                                                                                                            
class ClassSessionFeynmanViewSet(viewsets.ReadOnlyModelViewSet):                                                                                            
    queryset = ClassSessionFeynman.objects.all().order_by("id")                                                                                             
    serializer_class = ClassSessionFeynmanSerializer                                                                                                        
    authentication_classes = [JWTAuthentication]                                                                                                            
    permission_classes = [IsAuthenticated]                                                                                                                  
                                                                                                                                                            
    def get_queryset(self):                                                                                                                                 
        return ClassSessionFeynman.objects.filter(class_session__user=self.request.user).order_by("id")
