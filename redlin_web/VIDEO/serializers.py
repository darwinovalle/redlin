from rest_framework import serializers
from .models import Video, VideoSummary, VideoMCQ, VideoCloze

class VideoSerializer(serializers.ModelSerializer):
    languages = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="Lista de códigos de idioma preferidos (opcional)."
    )

    class Meta:
        model = Video
        fields = [
            'id', 'url', 'video_id', 'title', 'created_at',
            'processing_status', 'snippet_count', 'transcript_text',
            'languages'
        ]
        read_only_fields = [
            'id', 'video_id', 'created_at', 'processing_status',
            'snippet_count', 'transcript_text'
        ]

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


class ClozeValidateSerializer(serializers.Serializer):
    cloze_id = serializers.IntegerField()
    answer = serializers.CharField()
    cloze_type = serializers.ChoiceField(choices=['document', 'video'])