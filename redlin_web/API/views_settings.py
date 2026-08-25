"""Per-user LLM settings endpoint.

Authenticated only (DRF defaults: JWTAuthentication + IsAuthenticated).
GET returns the user's provider config (plaintext key never included).
PUT creates or updates the config; an empty api_key clears the stored key.
"""
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import UserLLMSettings
from .serializer import UserLLMSettingsCheckSerializer, UserLLMSettingsSerializer
from .services.llm_provider import DEFAULT_BASE_URLS, DEFAULT_MODELS, LLMConfig, PROVIDER_DISPATCH, SERVER_GEMINI_MODEL

# Lightweight check: hard cap on how long the provider's test call may take.
# Without this a slow/unreachable endpoint (e.g. a big Gemini model) would spin
# the modal forever with no feedback.
CHECK_TIMEOUT_SECONDS = 25


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


@extend_schema(
    methods=["POST"],
    request=UserLLMSettingsCheckSerializer,
    responses={200: dict},
    tags=["settings"],
)
@api_view(["POST"])
def llm_settings_check(request):
    serializer = UserLLMSettingsCheckSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    row = UserLLMSettings.objects.filter(user=request.user).first()
    provider = data.get("provider") or (row.provider if row else "gemini")

    if data.get("model_name"):
        model_name = data["model_name"]
    elif row and row.provider == provider and row.model_name:
        model_name = row.model_name
    else:
        model_name = DEFAULT_MODELS.get(provider, SERVER_GEMINI_MODEL)

    if provider == "ollama":
        base_url = DEFAULT_BASE_URLS.get("ollama")
    elif "base_url" in request.data:
        base_url = data.get("base_url") or DEFAULT_BASE_URLS.get(provider)
    elif row and row.provider == provider and row.base_url:
        base_url = row.base_url
    else:
        base_url = DEFAULT_BASE_URLS.get(provider)

    if "api_key" in request.data:
        api_key = data.get("api_key", "")
    elif row and row.provider == provider and row.encrypted_api_key:
        api_key = row.api_key or ""
    else:
        api_key = ""

    if provider == "gemini" and not api_key:
        api_key = os.getenv("GOOGLE_API_KEY", "")

    # API keys never contain whitespace; pasting from a terminal often leaves a
    # trailing newline/space that silently breaks the Bearer header.
    api_key = (api_key or "").strip()

    if not api_key:
        return Response(
            {"ok": False, "error": "API key is required to check this provider."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    dispatch = PROVIDER_DISPATCH.get(provider)
    if dispatch is None:
        return Response(
            {"ok": False, "error": f"Unknown LLM provider: {provider}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    config = LLMConfig(
        provider=provider,
        api_key=api_key,
        model=model_name,
        base_url=base_url,
        is_server_default=False,
    )

    # Run the dispatch in a worker thread so a slow/unresponsive provider fails
    # with a clear message instead of leaving the request hanging.
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(dispatch, "Reply with exactly: ok", config)
    try:
        result = future.result(timeout=CHECK_TIMEOUT_SECONDS)
    except FutureTimeoutError:
        executor.shutdown(wait=False)  # let the straggler thread drain on its own
        return Response(
            {"ok": False, "error": f"Provider did not respond within {CHECK_TIMEOUT_SECONDS}s."},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except Exception as exc:
        executor.shutdown(wait=False)
        return Response(
            {"ok": False, "error": str(exc)[:500] or "Provider check failed."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    executor.shutdown(wait=True)

    return Response(
        {
            "ok": True,
            "provider": provider,
            "model_name": model_name,
            "base_url": base_url or "",
            "message": "Provider is reachable.",
            "preview": (result or "").strip()[:120],
        },
        status=status.HTTP_200_OK,
    )
