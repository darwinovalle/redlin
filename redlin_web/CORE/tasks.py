from celery import shared_task
from django.utils import timezone
import logging
import time

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="CORE.tasks.heartbeat")
def heartbeat(self):
    """Pequeña tarea de prueba para verificar Celery/Beat con logging y estado STARTED."""
    logger.info("[heartbeat] start task_id=%s", self.request.id)
    time.sleep(0.5)
    payload = {"status": "ok", "timestamp": timezone.now().isoformat()}
    logger.info("[heartbeat] done task_id=%s payload=%s", self.request.id, payload)
    return payload


@shared_task(bind=True, name="CORE.tasks.recalculate_daily_metrics")
def recalculate_daily_metrics(self):
    """Placeholder: recalcular métricas diarias (XP, sesiones, etc.)."""
    logger.info("[recalculate_daily_metrics] running task_id=%s", self.request.id)
    return "metrics recalculated"


def _method_for_progress(p):
    model = p.content_type.model if p.content_type_id else ""
    if "feynman" in model:
        return "FEYNMAN"
    if "cloze" in model:
        return "CLOZE"
    return "MCQ"


@shared_task(bind=True, name="CORE.tasks.generate_reminders")
def generate_reminders(self):
    """Persistent review reminders.

    For every user with overdue SR items, keep exactly ONE unread review
    reminder, refreshed as the "N due" text/payload each run. It is not reset
    per day, so if the app (or its worker) was down for a while the next scan
    — or simply opening the app — still surfaces the pending work. It is
    cleared only once the user has no overdue items.
    """
    from collections import Counter
    from CORE.models import CoreLearningProgress, Reminder
    from API.models import User

    now = timezone.now()
    made = 0
    cleared = 0
    for user in User.objects.all():
        due = CoreLearningProgress.objects.filter(user=user, next_review_at__lte=now)
        total = due.count()
        unread = Reminder.objects.filter(user=user, kind=Reminder.KIND_REVIEW, read_at__isnull=True)
        if total == 0:
            # Nothing outstanding — dismiss any lingering unread review reminder.
            cleared += unread.update(read_at=now)
            continue

        methods = Counter(_method_for_progress(p) for p in due)
        subject = f"You have {total} review item{'s' if total != 1 else ''} due"
        payload = {"count": total, "methods": dict(methods)}

        keep = unread.order_by("-created_at").first()
        if keep is None:
            Reminder.objects.create(user=user, kind=Reminder.KIND_REVIEW, subject=subject, payload=payload)
        else:
            unread.exclude(pk=keep.pk).update(read_at=now)  # coalesce stragglers
            keep.subject = subject
            keep.payload = payload
            keep.save(update_fields=["subject", "payload"])
        made += 1
        logger.info("[generate_reminders] user=%s due=%s", user.id, total)
    return {"reminders_created": made, "reminders_cleared": cleared}