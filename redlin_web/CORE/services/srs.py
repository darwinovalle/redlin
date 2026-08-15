"""Spaced-repetition (SM-2) scheduling + study-streak helpers.

Pure, dependency-light functions so the core learning algorithm is easy to unit
test and reason about. The ORM wrappers live in this module too and update the
dormant CORE models (CoreLearningProgress, CoreAttempt, CoreXpAccount) at the
same time, so the whole "answer a question -> schedule next review -> streak
advances" loop is one transactional step.
"""
from django.db import transaction
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType

from CORE.services.timezone import user_now


INTERVAL_LADDER = [3, 8, 15, 30]

# A failed review comes back within hours (same-day re-test), not days. Once the
# lapse is passed, the item graduates back onto the day ladder via next_interval.
LAPSE_HOURS = 6


def clamp_quality(q: int) -> int:
    return max(0, min(5, int(q)))


def quality_from_attempt(correct: bool, latency_ms=None) -> int:
    """Map a raw right/wrong answer (+ optional response time) to SM-2 quality 0-5."""
    q = 5 if correct else 0
    if latency_ms and latency_ms > 15000:  # very slow even when right
        q = max(0, q - 1)
    return q


def quality_from_score(score) -> int:
    """Map a Feynman AI score (0-100) to SM-2 quality so pass (~>=70) -> >=3."""
    score = float(score or 0)
    if score >= 95:
        return 5
    if score >= 80:
        return 4
    if score >= 70:
        return 3
    if score >= 50:
        return 2
    if score >= 30:
        return 1
    return 0


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


def apply_progress(progress, correct: bool, latency_ms=None, now=None, quality=None):
    """Advance a CoreLearningProgress row from one answer.

    `quality` (0-5) overrides the automatic mapping (used by Feynman, which has
    its own AI score). Mutates and returns the row; caller must .save().
    """
    now = now or timezone.now()
    if quality is None:
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

    if passed:
        progress.interval = next_interval(progress.interval, passed)
        progress.next_review_at = now + timezone.timedelta(days=progress.interval)
    else:
        # Sub-day lapse: a failed review is re-tested within hours. `interval`
        # is 0 as a sentinel, so next_interval(0, passed=True) returns 3 on the
        # next pass — the item graduates back onto the normal day ladder.
        progress.interval = 0
        progress.next_review_at = now + timezone.timedelta(hours=LAPSE_HOURS)

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
                   latency_ms=None, raw_answer=None, ai_score=None, now=None,
                   quality=None):
    """Persist one answer and advance the whole loop (schedule + streak + XP).

    Creates/updates the per-item CoreLearningProgress, writes a CoreAttempt,
    awards XP and advances the daily streak. Safe to call inside a transaction.
    """
    from CORE.models import CoreLearningProgress, CoreAttempt, CoreXpAward

    progress, _ = CoreLearningProgress.objects.get_or_create(
        user=user, content_type_id=content_type_id, object_id=object_id
    )
    progress, passed, quality = apply_progress(progress, correct, latency_ms, now, quality)
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
    current, longest = update_streak(xp, today=user_now(user).date())
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


def record_feynman_review(*, user, prompt, answer_text, score):
    """Feed a graded Feynman answer into the SM-2 schedule.

    Feynman is scored by AI (0-100), so its SM-2 quality comes from
    `quality_from_score` rather than the raw correct flag. The progress row is
    keyed on the *prompt* object (not the attempt) so it shows up in the due
    review lists exactly like MCQ/Cloze items. Awards XP + advances the streak
    like any other answer.
    """
    ct = ContentType.objects.get_for_model(prompt)
    with transaction.atomic():
        return record_attempt(
            user=user,
            method="FEYNMAN",
            content_type_id=ct.id,
            object_id=prompt.id,
            correct=(score or 0) >= 60,
            raw_answer=answer_text,
            ai_score=score,
            quality=quality_from_score(score),
        )
