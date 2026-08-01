"""Per-user LLM settings endpoint.

Authenticated only (DRF defaults: JWTAuthentication + IsAuthenticated).
GET returns the user's provider config (plaintext key never included).
PUT creates or updates the config; an empty api_key clears the stored key.
"""
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import UserLLMSettings
from .serializer import UserLLMSettingsSerializer


@extend_schema(
    methods=["GET"],
    request=None,
    responses={200: UserLLMSettingsSerializer},
    tags=["settings"],
)
@extend_schema(
    methods=["PUT"],
    request=UserLLMSettingsSerializer,
    responses={200: UserLLMSettingsSerializer},
    tags=["settings"],
)
@api_view(["GET", "PUT"])
def llm_settings(request):
    if request.method == "GET":
        obj = UserLLMSettings.objects.filter(user=request.user).first()
        if obj is None:
            return Response({
                "provider": "gemini",
                "base_url": "",
                "model_name": "",
                "masked_api_key": None,
                "configured": False,
                "updated_at": None,
            })
        return Response(UserLLMSettingsSerializer(obj, context={"request": request}).data)

    obj, _ = UserLLMSettings.objects.get_or_create(user=request.user)
    serializer = UserLLMSettingsSerializer(obj, data=request.data, context={"request": request}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(UserLLMSettingsSerializer(obj, context={"request": request}).data, status=status.HTTP_200_OK)
