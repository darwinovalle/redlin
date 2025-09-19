import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from API.models import Document, Cloze, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user():
    # Using create (no custom manager with create_user implemented)
    return User.objects.create(username='testuser', password='testpassword', email='u@example.com')


@pytest.fixture
def authenticated_client(api_client, test_user):
    api_client.force_authenticate(user=test_user)
    return api_client


@pytest.fixture
def test_document(test_user):
    return Document.objects.create(user=test_user, title="Test Document")


@pytest.fixture
def document_cloze(test_document):
    return Cloze.objects.create(
        document=test_document,
        text_with_blank="The capital of France is ____.",
        answer="Paris"
    )


@pytest.mark.django_db
def test_validate_document_cloze_correct(authenticated_client, document_cloze):
    url = reverse('cloze-validate')
    data = {
        "cloze_id": document_cloze.id,
        "answer": "Paris",
        "cloze_type": "document"
    }
    response = authenticated_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.data['correct'] is True
    assert response.data['cloze_id'] == document_cloze.id


@pytest.mark.django_db
def test_validate_document_cloze_incorrect(authenticated_client, document_cloze):
    url = reverse('cloze-validate')
    data = {
        "cloze_id": document_cloze.id,
        "answer": "London",
        "cloze_type": "document"
    }
    response = authenticated_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_200_OK
    assert response.data['correct'] is False


@pytest.mark.django_db
def test_validate_cloze_not_found(authenticated_client):
    url = reverse('cloze-validate')
    data = {
        "cloze_id": 9999,
        "answer": "any",
        "cloze_type": "document"
    }
    response = authenticated_client.post(url, data, format='json')
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_validate_cloze_unauthenticated(api_client, document_cloze):
    url = reverse('cloze-validate')
    data = {
        "cloze_id": document_cloze.id,
        "answer": "Paris",
        "cloze_type": "document"
    }
    response = api_client.post(url, data, format='json')
    # Depending on authentication/CSRF settings this can be 401 (Unauthenticated) or 403 (Forbidden - CSRF)
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
