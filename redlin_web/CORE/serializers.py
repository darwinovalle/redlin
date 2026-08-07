from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType

from .models import Space, Topic, Board, Column, Card, CardResource


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


# Maps a friendly client resource_type to a (app_label, model_name) ContentType.
RESOURCE_MODELS = {
    "document": ("API", "document"),
    "book": ("API", "document"),
    "chapter": ("API", "document"),
    "video": ("VIDEO", "video"),
    "classsession": ("CLASSROOM", "classsession"),
    "class_session": ("CLASSROOM", "classsession"),
    "lecture": ("CLASSROOM", "classsession"),
}


class CardResourceSerializer(serializers.ModelSerializer):
    """Generic link Card <-> existing resource (Document/Video/ClassSession).

    On write it accepts a friendly `resource_type` + `resource_id` and resolves
    them to a (content_type, object_id). On read it returns the linked object's
    title/kind so the kanban UI can label and deep-link the material.
    """
    resource_type = serializers.ChoiceField(
        choices=list(RESOURCE_MODELS.keys()), write_only=True
    )
    resource_id = serializers.IntegerField(write_only=True)
    resource = serializers.SerializerMethodField()

    class Meta:
        model = CardResource
        fields = [
            "id", "card", "resource_type", "resource_id",
            "content_type", "object_id", "added_at", "resource",
        ]
        read_only_fields = ["id", "content_type", "object_id", "added_at", "resource"]

    def get_resource(self, obj):
        ref = obj.content_object
        if ref is None:
            return None
        return {
            "id": getattr(ref, "id", obj.object_id),
            "title": getattr(ref, "title", "") or str(ref),
            "kind": getattr(ref, "kind", "") or "",
        }

    def create(self, validated_data):
        rtype = validated_data.pop("resource_type").lower()
        rid = validated_data.pop("resource_id")
        app_label, model_name = RESOURCE_MODELS[rtype]
        ct = ContentType.objects.get(app_label=app_label, model=model_name)
        # Validate the referenced object exists, else the GenericFK would 500.
        ct.get_object_for_this_type(pk=rid)
        card = validated_data["card"]
        resource, _ = CardResource.objects.get_or_create(
            card=card, content_type=ct, object_id=rid
        )
        return resource


class CardSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    column_title = serializers.CharField(source="column.title", read_only=True)
    resources = CardResourceSerializer(many=True, read_only=True)

    class Meta:
        model = Card
        fields = [
            "id", "user_id", "column", "column_title", "title", "notes",
            "priority", "position", "due_date", "archived",
            "created_at", "updated_at", "resources",
        ]
        read_only_fields = ["id", "user_id", "column_title", "created_at", "updated_at"]


class ColumnSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, read_only=True)

    class Meta:
        model = Column
        fields = ["id", "board", "title", "position", "wip_limit", "color", "created_at", "cards"]
        read_only_fields = ["id", "created_at"]


class BoardSerializer(serializers.ModelSerializer):
    columns = ColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Board
        fields = ["id", "topic", "title", "color", "created_at", "columns"]
        read_only_fields = ["id", "created_at"]


def ensure_default_board(topic):
    """Guarantees a Topic has a Board with the default kanban columns."""
    board, _ = Board.objects.get_or_create(
        topic=topic, defaults={"title": topic.name, "color": topic.color}
    )
    if board.columns.count() == 0:
        for i, title in enumerate(["Backlog", "In progress", "Review", "Mastered"]):
            Column.objects.create(board=board, title=title, position=i)
    return board


class TopicSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    board = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            "id", "user_id", "name", "color", "emoji", "description",
            "sort_order", "archived", "created_at", "updated_at", "board",
        ]
        read_only_fields = ["id", "user_id", "created_at", "updated_at"]

    def get_board(self, obj):
        board = getattr(obj, "board", None)
        if board is None:
            return None
        return BoardSerializer(board).data

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["user"] = request.user
        topic = super().create(validated_data)
        ensure_default_board(topic)
        return topic