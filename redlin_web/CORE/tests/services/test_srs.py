import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType

from CORE.services import srs
from CORE.models import CoreLearningProgress, CoreAttempt, CoreXpAward
from API.models import Document, Feynman, User


@pytest.mark.django_db
def _progress(user, obj, interval=0):
    ct = ContentType.objects.get_for_model(Document)
    return CoreLearningProgress.objects.create(
        user=user, content_type=ct, object_id=obj.id, interval=interval
    )


# ----- pure scheduling helpers -----

def test_quality_from_attempt():
    assert srs.quality_from_attempt(True) == 5
    assert srs.quality_from_attempt(False) == 0
    assert srs.quality_from_attempt(True, latency_ms=20000) == 4
    assert srs.quality_from_attempt(True, latency_ms=200) == 5


def test_interval_ladder():
    assert srs.next_interval(0, True) == 3
    assert srs.next_interval(3, True) == 8
    assert srs.next_interval(8, True) == 15
    assert srs.next_interval(15, True) == 30
    assert srs.next_interval(30, True) == 30  # capped
    assert srs.next_interval(8, False) == 3   # failed -> soonest rung
    assert srs.next_interval(0, False) == 3


@pytest.mark.django_db
def test_apply_progress_advances_and_resets():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="D")
    p = _progress(u, d)
    p, passed, q = srs.apply_progress(p, True, latency_ms=1000)
    assert passed is True and q == 5
    assert p.interval == 3
    assert p.repetitions == 1 and p.consecutive_passes == 1
    assert p.last_reviewed is not None
    assert 0.0 < p.score <= 1.0
    assert p.next_review_at <= timezone.now() + timedelta(days=4)
    # a failure resets
    p, passed, q = srs.apply_progress(p, False)
    assert passed is False
    assert p.consecutive_passes == 0 and p.repetitions == 0


@pytest.mark.django_db
def test_mastery_after_three_passes():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="D")
    p = _progress(u, d, interval=8)
    for _ in range(3):
        p, passed, q = srs.apply_progress(p, True)
    assert p.status == "mastered"
    assert p.interval >= 15


# ----- streak -----

@pytest.mark.django_db
def test_streak_first_day_same_and_gap():
    u = User.objects.create()
    xp = u.xp_account
    today = timezone.localdate()
    cur, longest = srs.update_streak(xp, today)
    assert cur == 1 and longest == 1
    # same day: no change
    cur, longest = srs.update_streak(xp, today)
    assert cur == 1
    # next day: +1
    cur, longest = srs.update_streak(xp, today + timedelta(days=1))
    assert cur == 2 and longest == 2
    # gap of 3+ days -> reset to 1 (longest preserved)
    xp.last_active_date = today + timedelta(days=1)
    cur, longest = srs.update_streak(xp, today + timedelta(days=4))
    assert cur == 1 and longest == 2


# ----- end-to-end record_attempt -----

@pytest.mark.django_db
def test_record_attempt_full_loop():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="SR doc")
    ct = ContentType.objects.get_for_model(Document)
    res = srs.record_attempt(
        user=u, method="MCQ", content_type_id=ct.id, object_id=d.id,
        correct=True, latency_ms=900,
    )
    assert res["passed"] is True
    assert res["streak"] == 1
    assert res["interval_days"] == 3

    attempt = CoreAttempt.objects.filter(user=u, content_type=ct, object_id=d.id).first()
    assert attempt is not None and attempt.correct is True
    progress = CoreLearningProgress.objects.get(user=u, content_type=ct, object_id=d.id)
    assert progress.interval == 3 and progress.status == "learning"
    assert u.xp_account.xp_total == 20
    assert CoreXpAward.objects.filter(user=u).count() == 1


# ----- Feynman score -> SM-2 (Feynman is in the schedule now) -----

def test_quality_from_feynman_score():
    assert srs.quality_from_score(100) == 5
    assert srs.quality_from_score(90) == 4
    assert srs.quality_from_score(75) == 3
    assert srs.quality_from_score(70) == 3
    assert srs.quality_from_score(45) == 1
    assert srs.quality_from_score(30) == 1
    assert srs.quality_from_score(0) == 0


@pytest.mark.django_db
def test_feynman_attempt_advances_schedule():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="Feynman doc")
    f = Feynman.objects.create(document=d, prompt="Explain X")
    ct = ContentType.objects.get_for_model(Feynman)
    res = srs.record_attempt(
        user=u, method="FEYNMAN", content_type_id=ct.id, object_id=f.id,
        correct=True, ai_score=85, quality=srs.quality_from_score(85),
    )
    assert res["passed"] is True
    assert res["quality"] == 4
    assert res["interval_days"] == 3
    progress = CoreLearningProgress.objects.get(user=u, content_type=ct, object_id=f.id)
    assert progress.status == "learning" and progress.next_review_at is not None


# ----- sub-day lapse (failed reviews come back within hours) -----

@pytest.mark.django_db
def test_fail_schedules_subday_lapse():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="Lapse doc")
    p = _progress(u, d, interval=8)
    p, passed, q = srs.apply_progress(p, False)
    assert passed is False
    assert p.interval == 0  # sub-day sentinel
    assert srs.LAPSE_HOURS == 6
    expected = timezone.now() + timedelta(hours=6)
    assert abs((p.next_review_at - expected).total_seconds()) < 60


@pytest.mark.django_db
def test_passing_lapsed_item_returns_to_day_ladder():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="Recover doc")
    p = _progress(u, d)  # interval 0 (lapsed)
    p, passed, q = srs.apply_progress(p, True)
    assert passed is True
    assert p.interval == 3  # graduates back onto the day ladder


# ----- record_feynman_review (Feynman now feeds the schedule) -----

@pytest.mark.django_db
def test_record_feynman_review_schedules_from_score():
    u = User.objects.create()
    d = Document.objects.create(user=u, title="Feynman doc")
    f = Feynman.objects.create(document=d, prompt="Explain X")
    res = srs.record_feynman_review(user=u, prompt=f, answer_text="X because Y", score=85)
    assert res["passed"] is True
    assert res["quality"] == 4
    assert res["interval_days"] == 3
    ct = ContentType.objects.get_for_model(Feynman)
    progress = CoreLearningProgress.objects.get(user=u, content_type=ct, object_id=f.id)
    assert progress.interval == 3
    attempt = CoreAttempt.objects.filter(
        user=u, content_type=ct, object_id=f.id, method="FEYNMAN"
    ).first()
    assert attempt is not None and attempt.ai_score == 85
    assert u.xp_account.xp_total == 20