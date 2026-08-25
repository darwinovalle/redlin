"""Tests for the per-user LLM settings endpoint and Fernet key encryption."""
import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse

from API.models import User, UserLLMSettings
from API.services.llm_encryption import encrypt_api_key, decrypt_api_key


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user():
    return User.objects.create(username='llmuser', password='pw', email='llm@example.com')


@pytest.fixture
def authenticated_client(api_client, test_user):
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.mark.django_db
def test_get_default_shape_when_no_settings(authenticated_client):
    """GET returns the default Gemini shape without creating a DB row."""
    url = reverse('llm-settings')
    resp = authenticated_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body['provider'] == 'gemini'
    assert body['configured'] is False
    assert body['masked_api_key'] is None
    assert not UserLLMSettings.objects.filter(user__username='llmuser').exists()


@pytest.mark.django_db
def test_put_saves_and_get_returns_masked_key(authenticated_client, test_user):
    """PUT stores an encrypted key; GET returns only the masked view."""
    url = reverse('llm-settings')
    resp = authenticated_client.put(url, {
        'provider': 'openai',
        'api_key': 'sk-test-secret-key-1234',
        'model_name': 'gpt-4o-mini',
    }, format='json')
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body['provider'] == 'openai'
    assert body['configured'] is True
    assert body['masked_api_key'] == 'sk-t...1234'
    assert 'api_key' not in body  # plaintext never returned
    assert body['masked_api_key'] not in body.get('model_name', '')

    # Row exists with ciphertext only — plaintext never stored.
    row = UserLLMSettings.objects.get(user=test_user)
    assert row.encrypted_api_key
    assert 'sk-test-secret-key-1234' not in row.encrypted_api_key
    assert row.api_key == 'sk-test-secret-key-1234'  # in-memory decrypt works

    # GET reflects the saved state.
    resp2 = authenticated_client.get(url)
    assert resp2.json()['configured'] is True
    assert resp2.json()['provider'] == 'openai'


@pytest.mark.django_db
def test_blank_api_key_clears_stored_key(authenticated_client, test_user):
    """PUT without api_key keeps the key; an empty string clears it."""
    url = reverse('llm-settings')
    UserLLMSettings.objects.create(user=test_user, provider='gemini')
    test_user.llm_settings.api_key = 'old-secret'
    test_user.llm_settings.save()

    # No api_key field -> keep existing key.
    resp = authenticated_client.put(url, {'provider': 'claude'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert UserLLMSettings.objects.get(user=test_user).api_key == 'old-secret'

    # Explicit empty api_key -> clear.
    resp = authenticated_client.put(url, {'provider': 'claude', 'api_key': ''}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    row = UserLLMSettings.objects.get(user=test_user)
    assert row.encrypted_api_key == ''
    assert row.api_key is None


@pytest.mark.django_db
def test_unauthenticated_request_returns_401(api_client):
    """No Bearer token -> 401 (JWTAuthentication + IsAuthenticated default)."""
    url = reverse('llm-settings')
    resp = api_client.get(url)
    assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_fernet_round_trip(test_user):
    """encrypt_api_key / decrypt_api_key round-trip, and empty is a no-op."""
    assert encrypt_api_key('') == ''
    assert decrypt_api_key('') == ''
    ct = encrypt_api_key('sk-abc123')
    assert ct != 'sk-abc123'
    assert decrypt_api_key(ct) == 'sk-abc123'


@pytest.mark.django_db
def test_check_endpoint_success(authenticated_client, monkeypatch):
    """POST /settings/llm/check/ returns ok + preview when the provider answers."""
    url = reverse('llm-settings-check')
    monkeypatch.setattr(
        'API.views_settings.PROVIDER_DISPATCH',
        {'gemini': lambda prompt, config: 'ok'},
    )
    resp = authenticated_client.post(url, {'provider': 'gemini', 'api_key': 'sk-test'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    body = resp.json()
    assert body['ok'] is True
    assert body['provider'] == 'gemini'
    assert body['preview'] == 'ok'


@pytest.mark.django_db
def test_check_endpoint_requires_api_key(authenticated_client):
    """No key stored and none supplied -> 400 instead of hitting a provider."""
    url = reverse('llm-settings-check')
    resp = authenticated_client.post(url, {'provider': 'openai'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp.json()['ok'] is False


@pytest.mark.django_db
def test_check_endpoint_times_out(authenticated_client, monkeypatch):
    """A provider that never answers fails fast with 504 instead of hanging."""
    import time

    url = reverse('llm-settings-check')

    def slow(prompt, config):
        time.sleep(2)
        return 'ok'

    monkeypatch.setattr('API.views_settings.PROVIDER_DISPATCH', {'gemini': slow})
    monkeypatch.setattr('API.views_settings.CHECK_TIMEOUT_SECONDS', 0.05)
    resp = authenticated_client.post(url, {'provider': 'gemini', 'api_key': 'sk-test'}, format='json')
    assert resp.status_code == status.HTTP_504_GATEWAY_TIMEOUT
    assert 'did not respond' in resp.json()['error']
