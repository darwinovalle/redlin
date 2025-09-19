"""Serializers for API app.

Cleaned after corruption introduced by previous automated edits.

Endpoint semantics (Issue #13):
  - Validation endpoint expects fields:
      cloze_id: int (id of Cloze or VideoCloze)
      answer: str (user provided answer)
    cloze_type: REQUIRED 'document' | 'video'. (Opción B: explícito, sin auto-detección)
  - Response returns:
      cloze_id, correct (bool), type ('document' | 'video')
"""

from rest_framework import serializers
from .models import User, Document, Summary, Flashcard, MCQ, Cloze, Feynman, FeynmanAttempt

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'

class SummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Summary
        fields = '__all__'

class FlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flashcard
        fields = '__all__'
        read_only_fields = [
            'last_reviewed', 'times_shown', 'next_review_at',
            'score', 'repetitions', 'interval', 'easiness'
        ]

class MCQSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCQ
        fields = '__all__'


class ClozeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cloze
        fields = ['id','document','text_with_blank','answer','options','meta','difficulty','created_at']
        read_only_fields = ['id','created_at']


class FeynmanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feynman
        fields = ['id','document','prompt','key_points','reference','created_at']
        read_only_fields = ['id','created_at']


class FeynmanAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeynmanAttempt
        fields = ['id','document','feynman','user','answer_text','score','tier','breakdown','key_points_coverage','created_at']
        read_only_fields = ['id','score','tier','breakdown','key_points_coverage','created_at','document','user']


class FeynmanAttemptCreateSerializer(serializers.Serializer):
    feynman_id = serializers.IntegerField()
    answer = serializers.CharField()

    def validate_answer(self, value: str) -> str:
        # Basic sanitization (strip, collapse whitespace)
        cleaned = ' '.join(value.strip().split())
        if len(cleaned) < 5:
            raise serializers.ValidationError('Respuesta demasiado corta.')
        return cleaned



class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


class ReviewSerializer(serializers.Serializer):
    # SM-2 quality response 0..5
    quality = serializers.IntegerField(min_value=0, max_value=5)


class ClozeGenerateSerializer(serializers.Serializer):
    document = serializers.IntegerField(required=False)
    video = serializers.IntegerField(required=False)
    max_items = serializers.IntegerField(required=False, min_value=1, max_value=20, default=6)

    def validate(self, attrs):
        if not attrs.get('document') and not attrs.get('video'):
            raise serializers.ValidationError('Debe enviar document o video.')
        if attrs.get('document') and attrs.get('video'):
            raise serializers.ValidationError('Envíe solo uno: document o video.')
        return attrs


class ClozeValidateSerializer(serializers.Serializer):
    cloze_id = serializers.IntegerField()
    answer = serializers.CharField()
    cloze_type = serializers.ChoiceField(choices=['document', 'video'], required=True)

    def validate_answer(self, value: str) -> str:  # simple normalization opportunity
        return value.strip()

