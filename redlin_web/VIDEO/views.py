from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from API.jwt_auth import JWTAuthentication
from .models import Video, VideoSummary, VideoMCQ
from .serializers import VideoSerializer, VideoSummarySerializer, VideoMCQSerializer
from .ai import process_video

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all().order_by('-id')
    serializer_class = VideoSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Video.objects.filter(user=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        languages = serializer.validated_data.pop('languages', None)
        video = serializer.save(user=self.request.user)
        try:
            process_video(video.id, languages=languages)
        except Exception:
            pass

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
        data = {
            "video": VideoSerializer(video).data,
            "summary": VideoSummarySerializer(video.summary).data if hasattr(video,'summary') else None,
            "mcqs": VideoMCQSerializer(video.mcqs.all(), many=True).data
        }
        return Response(data)

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
