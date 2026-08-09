from zoneinfo import ZoneInfo

from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .errors import ApiError, error_response
from .serializers import LoginSerializer, RegisterSerializer
from .services.auth_service import AuthService


@extend_schema(
    request=LoginSerializer,
    responses={
        200: {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "username": {"type": "string"},
                "email": {"type": "string"},
                "access": {"type": "string"},
                "refresh": {"type": "string"},
            },
            "required": ["id", "username", "email", "access", "refresh"],
        },
        401: OpenApiResponse(description="Invalid credentials"),
    },
    tags=["auth"],
    auth=[],
)
@csrf_exempt
@api_view(["POST"])
@permission_classes([])
@authentication_classes([])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = AuthService.authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
    except ApiError as api_error:
        return error_response(api_error)
    return Response(AuthService.login_payload(user))


@extend_schema(
    request=RegisterSerializer,
    responses={
        201: {
            "type": "object",
            "properties": {
                "id": {"type": "integer"},
                "username": {"type": "string"},
                "email": {"type": "string"},
                "access": {"type": "string"},
                "refresh": {"type": "string"},
            },
            "required": ["id", "username", "email", "access", "refresh"],
        },
        400: OpenApiResponse(description="Invalid data"),
    },
    tags=["auth"],
    auth=[],
)
@csrf_exempt
@api_view(["POST"])
@permission_classes([])
@authentication_classes([])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(AuthService.login_payload(user), status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    request={
        "application/json": {
            "type": "object",
            "properties": {"refresh": {"type": "string"}},
            "required": ["refresh"],
        }
    },
    responses={
        200: {
            "type": "object",
            "properties": {
                "access": {"type": "string"},
                "refresh": {"type": "string"},
            },
        }
    },
    tags=["auth"],
    auth=[],
)
@csrf_exempt
@api_view(["POST"])
@permission_classes([])
@authentication_classes([])
def refresh_token(request):
    try:
        tokens = AuthService.refresh_tokens(request.data.get("refresh"))
    except ApiError as api_error:
        return error_response(api_error)
    return Response(tokens)


@extend_schema(
    responses={
        200: {
            "type": "object",
            "properties": {"sub": {"type": "string"}, "type": {"type": "string"}},
        }
    },
    tags=["auth"],
    auth=[],
)
@api_view(["GET"])
@permission_classes([])
@authentication_classes([])
def whoami(request):
    try:
        identity = AuthService.read_identity(request.headers.get("Authorization"))
    except ApiError as api_error:
        return error_response(api_error)
    return Response(identity)


@extend_schema(
    responses={200: {"type": "object", "properties": {"ok": {"type": "boolean"}}}},
    tags=["auth"],
)
@api_view(["POST"])
def activity(request):
    """Record real user activity (idle-session heartbeat).

    Authenticated by default. Only this endpoint refreshes ``last_active_at``,
    so background polling never resets the idle timer. Writes are throttled to
    at most one DB update per 60 seconds.
    """
    user = request.user
    now = timezone.now()
    last = getattr(user, "last_active_at", None)
    if last is None or (now - last).total_seconds() > 60:
        user.last_active_at = now
        user.save(update_fields=["last_active_at"])
    return Response({"ok": True})


@extend_schema(
    request={
        "application/json": {
            "type": "object",
            "properties": {"timezone": {"type": "string", "example": "America/Bogota"}},
            "required": ["timezone"],
        }
    },
    responses={
        200: {"type": "object", "properties": {"ok": {"type": "boolean"}, "timezone": {"type": "string"}}},
        400: {"description": "Invalid IANA timezone"},
    },
    tags=["auth"],
)
@api_view(["POST"])
def set_timezone(request):
    """Store the user's IANA timezone (sent from the browser on app start)."""
    tz = str(request.data.get("timezone") or "").strip()
    try:
        ZoneInfo(tz)
    except Exception:
        return Response({"error": "invalid timezone"}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    if getattr(user, "timezone", "UTC") != tz:
        user.timezone = tz
        user.save(update_fields=["timezone"])
    return Response({"ok": True, "timezone": tz})
