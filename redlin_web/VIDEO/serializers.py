from rest_framework import serializers
from .models import Video, VideoSummary, VideoMCQ, VideoCloze, VideoFeynman, VideoFeynmanAttempt

class VideoSerializer(serializers.ModelSerializer):
    languages = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="Lista de códigos de idioma preferidos (opcional)."
    )
    # Absolute URL of the uploaded file (for MP4 uploads) so the frontend can
    # render a <video> player without knowing the media base URL itself.
    audio_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'url', 'video_id', 'title', 'created_at',
            'processing_status', 'snippet_count', 'transcript_text',
            'audio_file', 'audio_file_url', 'languages'
        ]
        read_only_fields = [
            'id', 'video_id', 'created_at', 'processing_status',
            'snippet_count', 'transcript_text', 'audio_file'
        ]

    def get_audio_file_url(self, obj):
        if not obj.audio_file:
            return None
        try:
            request = self.context.get('request')
            if request is not None:
                return request.build_absolute_uri(obj.audio_file.url)
            return obj.audio_file.url
        except Exception:
            return None

class VideoSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoSummary
        fields = '__all__'

class VideoMCQSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoMCQ
        fields = '__all__'

class VideoClozeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoCloze
        fields = '__all__'


class VideoFeynmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoFeynman
        fields = ['id','video','prompt','key_points','reference','created_at']
        read_only_fields = ['id','created_at']


class VideoFeynmanAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoFeynmanAttempt
        fields = ['id','video','feynman','user','answer_text','score','tier','breakdown','key_points_coverage','created_at']
        read_only_fields = ['id','video','user','score','tier','breakdown','key_points_coverage','created_at']


class VideoFeynmanAttemptCreateSerializer(serializers.Serializer):
    feynman_id = serializers.IntegerField()
    answer = serializers.CharField()

    def validate_answer(self, value: str) -> str:
        cleaned = ' '.join(value.strip().split())
        if len(cleaned) < 5:
            raise serializers.ValidationError('Answer too short.')
        return cleaned


class ClozeValidateSerializer(serializers.Serializer):
    cloze_id = serializers.IntegerField()
    answer = serializers.CharField()
    cloze_type = serializers.ChoiceField(choices=['document', 'video'])