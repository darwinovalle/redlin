from django.utils import timezone
from rest_framework import status

from API.errors import ApiError, ErrorCode
from API.jwt_auth import create_tokens, decode_token
from API.models import User


class AuthService:
    """Authentication orchestration isolated from HTTP view functions."""

    @staticmethod
    def authenticate(username: str, password: str) -> User:
        user = User.objects.filter(username=username, password=password).first()
        if not user:
            raise ApiError(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Invalid credentials",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        # Start the idle-session clock at login.
        user.last_active_at = timezone.now()
        user.save(update_fields=["last_active_at"])
        return user

    @staticmethod
    def login_payload(user: User) -> dict[str, str | int]:
        access, refresh = create_tokens(user.id)
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "access": access,
            "refresh": refresh,
        }

    @staticmethod
    def refresh_tokens(refresh_token: str | None) -> dict[str, str]:
        if not refresh_token:
            raise ApiError(
                code=ErrorCode.REFRESH_TOKEN_REQUIRED,
                message="Refresh token required",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            user_id = payload.get("sub")
            access, refresh = create_tokens(user_id)
        except Exception as exc:
            raise ApiError(
                code=ErrorCode.INVALID_TOKEN,
                message=str(exc),
                status_code=status.HTTP_401_UNAUTHORIZED,
            ) from exc
        return {"access": access, "refresh": refresh}

    @staticmethod
    def read_identity(authorization_header: str | None) -> dict[str, str | None]:
        if not authorization_header or not authorization_header.startswith("Bearer "):
            raise ApiError(
                code=ErrorCode.MISSING_BEARER_TOKEN,
                message="Missing bearer token",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        token = authorization_header.split(" ", 1)[1]
        try:
            payload = decode_token(token, expected_type="access")
        except Exception as exc:
            raise ApiError(
                code=ErrorCode.INVALID_TOKEN,
                message=str(exc),
                status_code=status.HTTP_401_UNAUTHORIZED,
            ) from exc
        return {"sub": payload.get("sub"), "type": payload.get("type")}
