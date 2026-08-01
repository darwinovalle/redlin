"""Tests for the unified LLM provider dispatch (llm_provider.py)."""
import pytest

from API.models import User, UserLLMSettings
from API.services import llm_provider


@pytest.fixture
def test_user():
    return User.objects.create(username='provuser', password='pw', email='prov@example.com')


@pytest.mark.django_db
def test_resolve_default_when_no_settings():
    """No user settings -> server default Gemini config."""
    cfg = llm_provider.resolve_llm_settings(None)
    assert cfg.provider == 'gemini'
    assert cfg.is_server_default is True
    assert cfg.base_url is None


@pytest.mark.django_db
def test_resolve_user_settings(test_user):
    """Saved settings -> user provider + decrypted key + non-default flag."""
    UserLLMSettings.objects.create(
        user=test_user,
        provider='openrouter',
        base_url='https://openrouter.ai/api/v1/',
        model_name='anthropic/claude-3.5-sonnet',
    )
    test_user.llm_settings.api_key = 'or-key-abc'
    test_user.llm_settings.save()

    cfg = llm_provider.resolve_llm_settings(test_user.id)
    assert cfg.provider == 'openrouter'
    assert cfg.api_key == 'or-key-abc'
    assert cfg.model == 'anthropic/claude-3.5-sonnet'
    assert cfg.base_url == 'https://openrouter.ai/api/v1/'
    assert cfg.is_server_default is False


@pytest.mark.django_db
def test_resolve_falls_back_when_row_has_no_key(test_user):
    """A settings row without a key still falls back to the server default."""
    UserLLMSettings.objects.create(user=test_user, provider='claude', encrypted_api_key='')
    cfg = llm_provider.resolve_llm_settings(test_user.id)
    assert cfg.is_server_default is True
    assert cfg.provider == 'gemini'


def test_provider_dispatch_mapping():
    """All six providers map to a callable; NIM/OpenRouter reuse the OpenAI client."""
    for provider in ('gemini', 'claude', 'openai', 'ollama', 'nvidia_nim', 'openrouter'):
        assert provider in llm_provider.PROVIDER_DISPATCH
    assert llm_provider.PROVIDER_DISPATCH['nvidia_nim'] is llm_provider._call_openai
    assert llm_provider.PROVIDER_DISPATCH['openrouter'] is llm_provider._call_openai


@pytest.mark.django_db
def test_generate_with_retry_uses_user_provider(monkeypatch, test_user):
    """generate_with_retry routes through the user's provider dispatch."""
    UserLLMSettings.objects.create(user=test_user, provider='gemini')
    test_user.llm_settings.api_key = 'user-gemini-key'
    test_user.llm_settings.save()

    captured = {}

    def fake_dispatch(prompt, config):
        captured['provider'] = config.provider
        captured['api_key'] = config.api_key
        captured['user_id_path'] = config.is_server_default
        return 'RESPONSE TEXT'

    monkeypatch.setitem(llm_provider.PROVIDER_DISPATCH, 'gemini', fake_dispatch)
    resp = llm_provider.generate_with_retry('hello', user_id=test_user.id, max_attempts=1)
    assert resp.text == 'RESPONSE TEXT'
    assert captured['provider'] == 'gemini'
    assert captured['api_key'] == 'user-gemini-key'
    assert captured['user_id_path'] is False


@pytest.mark.django_db
def test_generate_with_retry_unknown_provider_raises(monkeypatch, test_user):
    """An unknown provider surfaces as a clear ValueError."""
    UserLLMSettings.objects.create(user=test_user, provider='gemini')
    test_user.llm_settings.api_key = 'k'
    test_user.llm_settings.save()

    monkeypatch.setattr(llm_provider, 'PROVIDER_DISPATCH', {'gemini': llm_provider._call_gemini})
    monkeypatch.setattr(
        llm_provider,
        'resolve_llm_settings',
        lambda user_id: llm_provider.LLMConfig(provider='nonexistent', is_server_default=False),
    )
    with pytest.raises(ValueError, match='Unknown LLM provider'):
        llm_provider.generate_with_retry('hi', user_id=test_user.id, max_attempts=1)


def test_is_rate_limit_error():
    assert llm_provider._is_rate_limit_error(Exception('429 quota exceeded')) is True
    assert llm_provider._is_rate_limit_error(Exception('Resource has been exhausted')) is True
    assert llm_provider._is_rate_limit_error(Exception('bad request')) is False
