from rest_framework import serializers

from .models import (
    ClassSession,
    TranscriptSegment,
    ClassSessionSummary,
    ClassSessionMCQ,
    ClassSessionCloze,
    ClassSessionFeynman,
    ClassSessionFeynmanAttempt
)


class ClassSessionStartSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    language = serializers.CharField(max_length=8, required=False, default="en")


class ClassSessionUploadAudioSerializer(serializers.Serializer):
    audio_file = serializers.FileField()


class ClassSessionFinishSerializer(serializers.Serializer):
    transcript_text = serializers.CharField(required=False, allow_blank=True, default="")


class TranscriptSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TranscriptSegment
        fields = [
            "id",
            "class_session",
            "sequence",
            "start_sec",
            "end_sec",
            "speaker_label",
            "text",
            "confidence",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ClassSessionSerializer(serializers.ModelSerializer):
    segments = TranscriptSegmentSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = ClassSession
        fields = [
            "id",
            "user",
            "linked_document",
            "title",
            "status",
            "language",
            "audio_file",
            "cover_image_url",
            "transcript_text",
            "source_meta",
            "error_message",
            "started_at",
            "ended_at",
            "created_at",
            "updated_at",
            "segments",
        ]

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        url = obj.cover_image.url
        if request:
            return request.build_absolute_uri(url)
        return url
        read_only_fields = [
            "id",
            "user",
            "linked_document",
            "status",
            "transcript_text",
            "source_meta",
            "error_message",
            "started_at",
            "ended_at",
            "created_at",
            "updated_at",
            "segments",
        ]


class ClassSessionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSessionSummary
        fields = ["id", "class_session", "content"]


class ClassSessionMCQSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSessionMCQ
        fields = ["id", "class_session", "question", "correct_answer", "option_1", "option_2", "option_3"]


class ClassSessionClozeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSessionCloze
        fields = ["id", "class_session", "text_with_blank", "answer", "context", "source_span", "created_at", "options", "meta", "difficulty"]


class ClassSessionFeynmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSessionFeynman
        fields = ["id", "class_session", "prompt", "key_points", "reference", "created_at"]


class ClassSessionFeynmanAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSessionFeynmanAttempt
        fields = [
            "id", "class_session", "feynman", "user", "answer_text", "score", "tier",
            "breakdown", "key_points_coverage", "created_at", "updated_at"
        ]
