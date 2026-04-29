import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from API.models import User
from CLASSROOM.models import ClassSession


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_user():
    return User.objects.create(username="classroom-user", email="classroom@example.com", password="secret")


@pytest.mark.django_db
def test_start_session_creates_recording_session(api_client, auth_user):
    api_client.force_authenticate(user=auth_user)

    response = api_client.post(
        reverse("classroom-session-start"),
        {"title": "Biology 101", "language": "es"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["title"] == "Biology 101"
    assert response.data["status"] == ClassSession.STATUS_RECORDING
    assert ClassSession.objects.filter(user=auth_user, title="Biology 101").exists()


@pytest.mark.django_db
def test_finish_with_manual_transcript_queues_processing(api_client, auth_user, monkeypatch):
    api_client.force_authenticate(user=auth_user)
    session = ClassSession.objects.create(user=auth_user, title="Math Class", language="es")

    called = {"session_id": None}

    def fake_delay(session_id):
        called["session_id"] = session_id

    monkeypatch.setattr("CLASSROOM.views.process_class_session_task.delay", fake_delay)

    response = api_client.post(
        reverse("classroom-session-finish", kwargs={"pk": session.id}),
        {"transcript_text": "This class explains integrals and derivatives with practical examples."},
        format="json",
    )

    session.refresh_from_db()
    assert response.status_code == status.HTTP_202_ACCEPTED
    assert session.status == ClassSession.STATUS_READY
    assert called["session_id"] == session.id


@pytest.mark.django_db
def test_status_returns_core_progress_fields(api_client, auth_user):
    api_client.force_authenticate(user=auth_user)
    session = ClassSession.objects.create(
        user=auth_user,
        title="History",
        status=ClassSession.STATUS_TRANSCRIBING,
        error_message="",
    )

    response = api_client.get(reverse("classroom-session-session-status", kwargs={"pk": session.id}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == session.id
    assert response.data["status"] == ClassSession.STATUS_TRANSCRIBING
    assert "updated_at" in response.data


@pytest.mark.django_db
def test_results_without_linked_document_returns_not_found(api_client, auth_user):
    api_client.force_authenticate(user=auth_user)
    session = ClassSession.objects.create(user=auth_user, title="Physics")

    response = api_client.get(reverse("classroom-session-results", kwargs={"pk": session.id}))

    assert response.status_code == status.HTTP_404_NOT_FOUND
