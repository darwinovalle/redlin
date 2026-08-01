"""Unified LLM provider dispatch for Redlin.

Replaces the two independent Gemini clients that previously lived in
``processing_common.py`` and ``VIDEO/ai.py``. Per-user provider configuration
(``UserLLMSettings``) is resolved from the DB keyed by user id; a user with no
configured key falls back to the server-default Gemini key (env GOOGLE_API_KEY).

Every dispatch returns a plain string, which the unified caller wraps in
``GeminiResponseMock`` so existing callers that read ``resp.text`` keep working.
"""
import os
import re
import threading
import time
import random
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


class GeminiResponseMock:
    """Mock response object to maintain compatibility with Gemini's .text attribute."""
    def __init__(self, text: str):
        self.text = text


# --------------------------------------------------------------------------- #
# Defaults (server-level configuration)
# --------------------------------------------------------------------------- #
SERVER_GEMINI_MODEL = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b-cloud")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
ANTHROPIC_MAX_TOKENS = int(os.getenv("ANTHROPIC_MAX_TOKENS", "8192"))

DEFAULT_MODELS = {
    "gemini": SERVER_GEMINI_MODEL,
    "claude": "claude-3-5-sonnet-latest",
    "openai": "gpt-4o-mini",
    "ollama": OLLAMA_MODEL,
    "nvidia_nim": "meta/llama-3.3-70b-instruct",
    "openrouter": "anthropic/claude-3.5-sonnet",
}

DEFAULT_BASE_URLS = {
    "nvidia_nim": "https://integrate.api.nvidia.com/v1/",
    "openrouter": "https://openrouter.ai/api/v1/",
}


@dataclass
class LLMConfig:
    provider: str = "gemini"
    api_key: str = ""
    model: str = SERVER_GEMINI_MODEL
    base_url: str | None = None
    is_server_default: bool = True


# --------------------------------------------------------------------------- #
# Settings resolution
# --------------------------------------------------------------------------- #
def resolve_llm_settings(user_id: int | None = None) -> LLMConfig:
    """Return the per-user LLM config, or the server default Gemini config.

    Lazy-imports the model to avoid a models<->services import cycle at module
    load. Any DB error degrades to the server default.
    """
    if user_id is not None:
        try:
            from ..models import UserLLMSettings

            row = UserLLMSettings.objects.filter(user_id=user_id).first()
            if row is not None and row.encrypted_api_key:
                return LLMConfig(
                    provider=row.provider,
                    api_key=row.api_key,  # in-memory decrypt
                    model=row.model_name or DEFAULT_MODELS.get(row.provider, SERVER_GEMINI_MODEL),
                    base_url=row.base_url or DEFAULT_BASE_URLS.get(row.provider),
                    is_server_default=False,
                )
        except Exception as exc:  # pragma: no cover - defensive
            print(f"[LLMProvider] Failed to resolve user settings: {exc}")
    return LLMConfig(
        provider="gemini",
        api_key=os.getenv("GOOGLE_API_KEY", ""),
        model=SERVER_GEMINI_MODEL,
        base_url=None,
        is_server_default=True,
    )


# --------------------------------------------------------------------------- #
# Provider dispatch (each returns a plain string)
# --------------------------------------------------------------------------- #
_gemini_lock = threading.Lock()


def _call_gemini(prompt: str, config: LLMConfig) -> str:
    import google.generativeai as genai

    # genai.configure is process-global; lock guards cross-thread reconfiguration.
    with _gemini_lock:
        genai.configure(api_key=config.api_key)
        model = genai.GenerativeModel(config.model)
        resp = model.generate_content(prompt)
    return resp.text


def _call_openai(prompt: str, config: LLMConfig) -> str:
    import openai

    if not config.api_key:
        raise ValueError(f"Missing API key for provider '{config.provider}'.")
    client = openai.OpenAI(api_key=config.api_key, base_url=config.base_url)
    resp = client.chat.completions.create(
        model=config.model,
        messages=[{"role": "user", "content": prompt}],
    )
    content = resp.choices[0].message.content
    return content or ""


def _call_anthropic(prompt: str, config: LLMConfig) -> str:
    import anthropic

    if not config.api_key:
        raise ValueError("Missing API key for provider 'claude'.")
    client = anthropic.Anthropic(api_key=config.api_key)
    resp = client.messages.create(
        model=config.model,
        max_tokens=ANTHROPIC_MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )
    return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")


def _call_ollama(prompt: str, config: LLMConfig) -> str:
    import ollama

    client = ollama.Client(host=config.base_url or OLLAMA_HOST)
    response = client.generate(model=config.model or OLLAMA_MODEL, prompt=prompt)
    return response["response"]


PROVIDER_DISPATCH = {
    "gemini": _call_gemini,
    "claude": _call_anthropic,
    "openai": _call_openai,
    "nvidia_nim": _call_openai,  # OpenAI-compatible at default base_url
    "openrouter": _call_openai,   # OpenAI-compatible at default base_url
    "ollama": _call_ollama,
}


# --------------------------------------------------------------------------- #
# Retry / rate-limit handling
# --------------------------------------------------------------------------- #
def _parse_retry_delay_seconds(error_message: str) -> int | None:
    """Try to extract retry_delay seconds from Gemini error string."""
    try:
        match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_message)
        if match:
            return int(match.group(1))
    except Exception:
        pass
    return None


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in ("429", "quota", "rate limit", "resource_exhausted", "exhausted"))


def generate_with_retry(
    prompt: str,
    *,
    user_id: int | None = None,
    max_attempts: int = 3,
    base_wait: int = 5,
) -> GeminiResponseMock:
    """Generate text via the user's configured provider (or server default).

    - Resolves the user's LLM config (falls back to server Gemini when none).
    - Retries with backoff on rate-limit errors (429 / quota / resource_exhausted).
    - Preserves the legacy server behavior: when the *server default* Gemini
      path fails for a non-rate-limit reason, tries the local Ollama fallback
      once before giving up.
    """
    config = resolve_llm_settings(user_id)
    dispatch = PROVIDER_DISPATCH.get(config.provider)
    if dispatch is None:
        raise ValueError(f"Unknown LLM provider: {config.provider}")

    last_exc: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            text = dispatch(prompt, config)
            return GeminiResponseMock(text)
        except Exception as exc:
            last_exc = exc
            # Rate-limit -> backoff and retry.
            if _is_rate_limit_error(exc):
                suggested = _parse_retry_delay_seconds(str(exc))
                wait = suggested if suggested is not None else min(60, base_wait * (2 ** (attempt - 1)))
                wait = int(wait + random.uniform(0, 0.25) * wait)
                print(f"[LLMProvider] Rate limit (provider={config.provider}) attempt {attempt}/{max_attempts}. Waiting {wait}s")
                time.sleep(wait)
                continue
            # Server-default Gemini path: fall back to local Ollama once.
            if config.is_server_default and config.provider == "gemini":
                print("[Fallback] Server Gemini failed. Trying Ollama immediately...")
                try:
                    return GeminiResponseMock(_call_ollama(prompt, config))
                except Exception as ollama_exc:
                    raise RuntimeError("Gemini failed, and Ollama fallback also failed") from ollama_exc
            # Non-rate-limit error on a user provider: retry a couple times with short backoff.
            if attempt < max_attempts:
                time.sleep(min(60, base_wait))
                continue
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("Fallo de generación sin excepción detallada")
