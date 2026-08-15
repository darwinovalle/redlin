from rest_framework import viewsets, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from VIDEO.tasks import process_video_task, process_video_file_task
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from API.jwt_auth import JWTAuthentication
from .models import Video, VideoSummary, VideoMCQ, VideoCloze, VideoFeynman, VideoFeynmanAttempt
from .serializers import (
    VideoSerializer, VideoSummarySerializer, VideoMCQSerializer, VideoClozeSerializer,
    VideoFeynmanSerializer, VideoFeynmanAttemptSerializer, VideoFeynmanAttemptCreateSerializer
)
from .ai import evaluate_video_feynman_attempt

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all().order_by('-id')
    serializer_class = VideoSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Video.objects.filter(user=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        languages = serializer.validated_data.pop('languages', None)
        video = serializer.save(user=self.request.user)
        uploaded = self.request.FILES.get('video_file')
        if uploaded:
            video.audio_file = uploaded
            video.title = getattr(uploaded, 'name', '') or video.title
            video.save(update_fields=['audio_file', 'title'])
            process_video_file_task.delay(video.id)
        else:
            process_video_task.delay(video.id, languages=languages)

    def list(self, request, *args, **kwargs):
        """Custom list to bypass full ModelSerializer in case of hidden serialization error.
        Returns minimal fields required by frontend. Also adds lightweight debug logging."""
        qs = self.get_queryset()
        out = []
        for v in qs:
            try:
                out.append({
                    'id': v.id,
                    'url': v.url,
                    'video_id': v.video_id,
                    'title': v.title,
                    'created_at': v.created_at,
                    'processing_status': v.processing_status,
                    'snippet_count': v.snippet_count,
                    'transcript_text': v.transcript_text,
                })
            except Exception as e:
                print(f"[Video list error] video {getattr(v,'id','?')}: {e}")
        return Response(out)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        video = self.get_object()
        if not hasattr(video, 'summary'):
            return Response({"detail":"Summary no disponible"}, status=404)
        return Response(VideoSummarySerializer(video.summary).data)

    @action(detail=True, methods=['get'])
    def mcqs(self, request, pk=None):
        video = self.get_object()
        qs = video.mcqs.all()
        return Response(VideoMCQSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def clozes(self, request, pk=None):
        """Listar VideoCloze del video (sub-recurso para simetría)."""
        video = self.get_object()
        vqs = video.clozes.all().order_by('-id')
        return Response(VideoClozeSerializer(vqs, many=True).data)

    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        video = self.get_object()
        if video.processing_status == 'processing':
            return Response({"detail":"Ya en procesamiento"}, status=400)
        video.processing_status = 'pending'
        video.save()
        languages = request.data.get("languages")
        if isinstance(languages, str):
            languages = [l.strip() for l in languages.split(",") if l.strip()]
        process_video(video.id, languages=languages)
        return Response({"detail":"Reprocesando"})

    @action(detail=True, methods=['get'])
    def full_details(self, request, pk=None):
        video = self.get_object()
        ctx = self.get_serializer_context()  # gives request → absolute media URLs
        data = {
            "video": VideoSerializer(video, context=ctx).data,
            "summary": VideoSummarySerializer(video.summary).data if hasattr(video,'summary') else None,
            "mcqs": VideoMCQSerializer(video.mcqs.all(), many=True).data,
            "clozes": VideoClozeSerializer(video.clozes.all(), many=True).data,
            "feynman": VideoFeynmanSerializer(video.feynmans.all().order_by('id'), many=True).data,
        }
        return Response(data)

    # ---------------- Nested Feynman endpoints (Issue #14) ----------------
    @action(detail=True, methods=['get'], url_path='feynman/prompts')
    def feynman_prompts(self, request, pk=None):
        video = self.get_object()
        qs = video.feynmans.all().order_by('id')
        return Response(VideoFeynmanSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='feynman/history')
    def feynman_history(self, request, pk=None):
        video = self.get_object()
        attempts = VideoFeynmanAttempt.objects.filter(video=video, user=request.user).order_by('-id')
        return Response(VideoFeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=True, methods=['post'], url_path='feynman/evaluate')
    def feynman_evaluate(self, request, pk=None):
        video = self.get_object()
        feynman_id = request.data.get('feynman_id')
        answer = request.data.get('answer') or ''
        if not feynman_id:
            return Response({'detail':'feynman_id requerido'}, status=400)
        try:
            fid = int(feynman_id)
        except ValueError:
            return Response({'detail':'feynman_id inválido'}, status=400)
        f_obj = VideoFeynman.objects.filter(id=fid, video=video).first()
        if not f_obj:
            return Response({'detail':'Feynman not found'}, status=404)
        attempt = evaluate_video_feynman_attempt(f_obj, answer, request.user)
        # SR scheduling + CoreAttempt + XP + streak happen inside the evaluator.
        return Response(VideoFeynmanAttemptSerializer(attempt).data, status=201)


class VideoFeynmanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VideoFeynman.objects.all().order_by('id')
    serializer_class = VideoFeynmanSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = VideoFeynman.objects.filter(video__user=self.request.user).order_by('id')
        vid = self.request.query_params.get('video')
        if vid:
            try:
                qs = qs.filter(video_id=int(vid))
            except ValueError:
                pass
        return qs

    @action(detail=False, methods=['get'])
    def attempts(self, request):
        fid = request.query_params.get('feynman')
        if not fid:
            return Response([], status=200)
        try:
            fid_int = int(fid)
        except ValueError:
            return Response({'detail':'invalid id'}, status=400)
        attempts = VideoFeynmanAttempt.objects.filter(feynman__id=fid_int, user=request.user).order_by('-id')
        return Response(VideoFeynmanAttemptSerializer(attempts, many=True).data)

    @action(detail=False, methods=['post'])
    def attempt(self, request):
        serializer = VideoFeynmanAttemptCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        f_id = serializer.validated_data['feynman_id']
        answer = serializer.validated_data['answer']
        f_obj = VideoFeynman.objects.filter(id=f_id, video__user=request.user).first()
        if not f_obj:
            return Response({'detail':'Feynman not found'}, status=404)
        attempt = evaluate_video_feynman_attempt(f_obj, answer, request.user)
        return Response(VideoFeynmanAttemptSerializer(attempt).data, status=201)

class VideoSummaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VideoSummary.objects.all()
    serializer_class = VideoSummarySerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

class VideoMCQViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VideoMCQ.objects.all()
    serializer_class = VideoMCQSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
