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
