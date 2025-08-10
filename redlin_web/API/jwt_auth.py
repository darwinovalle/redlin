import datetime
import time
import jwt
from django.conf import settings
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
        return (user, None)
