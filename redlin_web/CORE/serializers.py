from rest_framework import serializers
from .models import Space


class SpaceSerializer(serializers.ModelSerializer):
    """Serializer básico para Space.

    El usuario (owner) se infiere del request autenticado al crear.
    """
    user_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Space
        fields = ['id', 'user_id', 'name', 'description', 'visibility', 'created_at']
        read_only_fields = ['id', 'user_id', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user
        return super().create(validated_data)
