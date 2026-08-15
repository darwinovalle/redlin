import pytest
from datetime import timedelta
from django.urls import reverse
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient

from API.models import User, Document, MCQ, Cloze, Feynman
from CORE.models import CoreLearningProgress


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user():
    return User.objects.create(username='revuser', password='pw', email='r@example.com')


@pytest.fixture
def authenticated_client(api_client, test_user):
    api_client.force_authenticate(user=test_user)
    return api_client


def _due_row(user, target, hours_ago=1):
    ct = ContentType.objects.get_for_model(target)
    return CoreLearningProgress.objects.create(
        user=user, content_type=ct, object_id=target.id,
        next_review_at=timezone.now() - timedelta(hours=hours_ago),
        interval=0, times_shown=1,
    )


@pytest.mark.django_db
def test_due_groups_by_source_with_detail(authenticated_client, test_user):
    doc = Document.objects.create(user=test_user, title="Doc A")
    mcq = MCQ.objects.create(document=doc, question="Q1", correct_answer="B",
                             option_1="A", option_2="B", option_3="C")
    cloze = Cloze.objects.create(document=doc, text_with_blank="___ is X.", answer="X")
    feynman = Feynman.objects.create(document=doc, prompt="Explain Y")
    for t in (mcq, cloze, feynman):
        _due_row(test_user, t)

    resp = authenticated_client.get(reverse('reminders-due'))
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 3
    assert len(data["groups"]) == 1
    g = data["groups"][0]
    assert g["source"] == "document" and g["title"] == "Doc A"
    assert {i["method"] for i in g["items"]} == {"MCQ", "CLOZE", "FEYNMAN"}
    by_type = {i["detail"]["type"]: i["detail"] for i in g["items"]}
    assert by_type["mcq"]["correct_answer"] == "B"
    assert set(by_type["mcq"]["options"]) == {"A", "B", "C"}
    assert by_type["cloze"]["answer"] == "X"
    assert by_type["feynman"]["prompt"] == "Explain Y"


@pytest.mark.django_db
def test_due_groups_empty(authenticated_client):
    resp = authenticated_client.get(reverse('reminders-due'))
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0 and data["groups"] == []


@pytest.mark.django_db
def test_review_feynman_evaluate_scores_and_schedules(authenticated_client, test_user, monkeypatch):
    doc = Document.objects.create(user=test_user, title="Doc B")
    feynman = Feynman.objects.create(document=doc, prompt="Explain X")
    ct = ContentType.objects.get_for_model(Feynman)

    class FakeResp:
        text = '{"score": 85, "feedback": "Nice work."}'

    from API import feynman_ai
    monkeypatch.setattr(feynman_ai, "generate_with_retry", lambda *a, **k: FakeResp())

    resp = authenticated_client.post(
        reverse('review-feynman-evaluate'),
        {"content_type_id": ct.id, "object_id": feynman.id, "answer": "X because Y"},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] == 85
    assert data["passed"] is True
    assert data["feedback"] == "Nice work."
    # SR schedule recorded keyed on the Feynman prompt.
    progress = CoreLearningProgress.objects.get(user=test_user, content_type=ct, object_id=feynman.id)
    assert progress.interval == 3


@pytest.mark.django_db
def test_review_feynman_evaluate_unknown_target(authenticated_client, test_user):
    doc = Document.objects.create(user=test_user, title="Doc C")
    ct = ContentType.objects.get_for_model(Feynman)
    resp = authenticated_client.post(
        reverse('review-feynman-evaluate'),
        {"content_type_id": ct.id, "object_id": 9999, "answer": "hello"},
        format="json",
    )
    assert resp.status_code == 404
