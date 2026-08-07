"""Spaced-repetition (SM-2) scheduling + study-streak helpers.

Pure, dependency-light functions so the core learning algorithm is easy to unit
test and reason about. The ORM wrappers live in this module too and update the
dormant CORE models (CoreLearningProgress, CoreAttempt, CoreXpAccount) at the
same time, so the whole "answer a question -> schedule next review -> streak
advances" loop is one transactional step.
"""
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType


INTERVAL_LADDER = [3, 8, 15, 30]


def clamp_quality(q: int) -> int:
    return max(0, min(5, int(q)))


def quality_from_attempt(correct: bool, latency_ms=None) -> int:
    """Map a raw right/wrong answer (+ optional response time) to SM-2 quality 0-5."""
    q = 5 if correct else 0
    if latency_ms and latency_ms > 15000:  # very slow even when right
        q = max(0, q - 1)
    return q


def next_interval(current_interval, passed: bool) -> int:
    """Move along the configured ladder (3 -> 8 -> 15 -> 30 days).

    A failed review resets to the soonest rung (3 days) so a weak topic is
    iterated again sooner; a pass steps to the next rung, capped at 30 days.
    """
    current = int(current_interval or 0)
    if not passed:
        return INTERVAL_LADDER[0]
    for rung in INTERVAL_LADDER:
        if rung > current:
            return rung
    return INTERVAL_LADDER[-1]


def apply_progress(progress, correct: bool, latency_ms=None, now=None):
    """Advance a CoreLearningProgress row from one answer.

    Mutates and returns the row per our SM-2-ish ladder. Caller must .save().
    """
    now = now or timezone.now()
    quality = quality_from_attempt(correct, latency_ms)
    passed = quality >= 3

    progress.times_shown += 1
    progress.last_reviewed = now
    progress.last_quality = quality

    if passed:
        progress.consecutive_passes += 1
        progress.repetitions += 1
    else:
        progress.consecutive_passes = 0
        progress.repetitions = 0

    progress.interval = next_interval(progress.interval, passed)
    progress.next_review_at = now + timezone.timedelta(days=progress.interval)

    prev_score = progress.score or 0.0
    progress.score = round(prev_score * 0.9 + (quality / 5.0) * 0.1, 4)

    if progress.consecutive_passes >= 3 and progress.interval >= 15:
        progress.status = "mastered"
    elif progress.times_shown > 0:
        progress.status = "learning"

    return progress, passed, quality


def update_streak(xp, today=None):
    """Advance a CoreXpAccount daily-streak from one day of activity.

    Same-day activity is a no-op; a gap of >1 day restarts the streak at 1;
    back-to-back days increment it. Returns (current_streak, longest_streak).
    """
    today = today or timezone.localdate()
    last = xp.last_active_date

    if last == today:
        return xp.current_streak, xp.longest_streak

    if last is None or (today - last).days > 1:
        xp.current_streak = 1
    elif (today - last).days == 1:
        xp.current_streak += 1

    xp.last_active_date = today
    xp.longest_streak = max(xp.longest_streak, xp.current_streak)
    return xp.current_streak, xp.longest_streak


def resolve_target(content_type_id, object_id):
    """Resolve a (content_type, object_id) to its model instance, or None."""
    try:
        ct = ContentType.objects.get(pk=content_type_id)
    except ContentType.DoesNotExist:
        return None
    try:
        return ct.get_object_for_this_type(pk=object_id)
    except ct.model_class().DoesNotExist:
        return None


def record_attempt(*, user, method, content_type_id, object_id, correct,
                   latency_ms=None, raw_answer=None, ai_score=None, now=None):
    """Persist one answer and advance the whole loop (schedule + streak + XP).

    Creates/updates the per-item CoreLearningProgress, writes a CoreAttempt,
    awards XP and advances the daily streak. Safe to call inside a transaction.
    """
    from CORE.models import CoreLearningProgress, CoreAttempt, CoreXpAward

    progress, _ = CoreLearningProgress.objects.get_or_create(
        user=user, content_type_id=content_type_id, object_id=object_id
    )
    progress, passed, quality = apply_progress(progress, correct, latency_ms, now)
    progress.save()

    attempt = CoreAttempt.objects.create(
        user=user,
        method=method,
        content_type_id=content_type_id,
        object_id=object_id,
        correct=correct,
        latency_ms=latency_ms,
        raw_answer=raw_answer,
        ai_score=ai_score,
        quality=quality,
    )

    xp = user.xp_account
    gained = 20 if correct else 8
    xp.add_xp(gained)
    CoreXpAward.objects.create(user=user, amount=gained, reason=f"{method} {'correct' if correct else 'attempt'}")
    current, longest = update_streak(xp)
    xp.save()

    return {
        "attempt_id": attempt.id,
        "content_type": content_type_id,
        "object_id": object_id,
        "passed": passed,
        "quality": quality,
        "interval_days": progress.interval,
        "next_review_at": progress.next_review_at,
        "status": progress.status,
        "streak": current,
        "longest_streak": longest,
        "xp_total": xp.xp_total,
    }