import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from API.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_login_invalid_credentials_returns_standard_error(api_client):
    response = api_client.post(
        reverse("login"),
        {"username": "unknown-user", "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error_code"] == "AUTH_INVALID_CREDENTIALS"
    assert response.data["error"] == "Invalid credentials"


@pytest.mark.django_db
def test_refresh_without_token_returns_standard_error(api_client):
    response = api_client.post(reverse("token-refresh"), {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "AUTH_REFRESH_TOKEN_REQUIRED"
    assert response.data["error"] == "Refresh token required"


@pytest.mark.django_db
def test_whoami_without_bearer_token_returns_standard_error(api_client):
    response = api_client.get(reverse("whoami"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error_code"] == "AUTH_MISSING_BEARER_TOKEN"
    assert response.data["error"] == "Missing bearer token"


@pytest.mark.django_db
def test_login_success_payload_is_backward_compatible(api_client):
    User.objects.create(username="maria", email="maria@example.com", password="123456")

    response = api_client.post(
        reverse("login"),
        {"username": "maria", "password": "123456"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["username"] == "maria"
    assert response.data["email"] == "maria@example.com"
    assert "access" in response.data
    assert "refresh" in response.data
