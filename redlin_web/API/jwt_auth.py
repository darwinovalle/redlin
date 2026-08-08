import datetime
import time
import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework import authentication, exceptions
from .models import User


def create_tokens(user_id: int):
    now = int(time.time())
    access_payload = {
    'sub': str(user_id),  # RFC: subject must be a string
        'type': 'access',
        'iat': now,
        'exp': now + 60 * 60,  # 60 minutes
    }
    refresh_payload = {
    'sub': str(user_id),
        'type': 'refresh',
        'iat': now,
        'exp': now + 60 * 60 * 24 * 7,  # 7 days
    }
    access = jwt.encode(access_payload, settings.SECRET_KEY, algorithm='HS256')
    refresh = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm='HS256')
    return access, refresh


def decode_token(token: str, expected_type: str = 'access'):
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=['HS256'],
            leeway=30,  # tolerate small clock skew
            options={
                'require': ['exp', 'iat', 'sub', 'type'],
            }
        )
        if payload.get('type') != expected_type:
            raise exceptions.AuthenticationFailed('Invalid token type')
        return payload
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed('Token expired')
    except jwt.DecodeError:
        raise exceptions.AuthenticationFailed('Invalid token (decode error)')
    except jwt.InvalidSignatureError:
        raise exceptions.AuthenticationFailed('Invalid token signature')
    except jwt.InvalidTokenError:
        raise exceptions.AuthenticationFailed('Invalid token')


class JWTAuthentication(authentication.BaseAuthentication):
    keyword = 'Bearer'

    def authenticate_header(self, request):
        # Advertise WWW-Authenticate: Bearer so DRF returns 401 (not 403) for
        # token/session failures. Without this, AuthenticationFailed is coerced
        # to 403 and the frontend's silent token-refresh never triggers.
        return self.keyword

    def authenticate(self, request):
        auth = authentication.get_authorization_header(request).split()
        if not auth:
            return None
        if auth[0].decode().lower() != self.keyword.lower():
            return None
        if len(auth) != 2:
            raise exceptions.AuthenticationFailed('Invalid auth header')

        token = auth[1].decode()
        payload = decode_token(token, expected_type='access')
        user_id = payload.get('sub')
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            raise exceptions.AuthenticationFailed('Invalid subject in token')
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found')

        # Idle session timeout: the token may still be valid, but if the user has
        # had no real activity for SESSION_IDLE_TIMEOUT_SECONDS, reject the
        # request. The frontend sends heartbeats only on real interaction, so
        # background polling (e.g. the reminder bell) never keeps this alive.
        last_active = getattr(user, 'last_active_at', None)
        if last_active is not None:
            idle_seconds = (timezone.now() - last_active).total_seconds()
            if idle_seconds > settings.SESSION_IDLE_TIMEOUT_SECONDS:
                # Pass a dict so DRF 3.15 renders the machine-readable code key
                # in the response body (a bare string drops it from the JSON).
                raise exceptions.AuthenticationFailed({
                    'detail': 'Session expired. Please log in again.',
                    'code': 'session_expired',
                })

        return (user, None)
