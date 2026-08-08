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
    """Daily scan: for each user, surface one 'due for review' reminder when SR
    items are overdue. One summary Reminder per user per day (unread)."""
    from collections import Counter
    from CORE.models import CoreLearningProgress, Reminder
    from API.models import User

    now = timezone.now()
    made = 0
    for user in User.objects.all():
        due = CoreLearningProgress.objects.filter(user=user, next_review_at__lte=now).select_related("content_type")
        total = due.count()
        if total == 0:
            continue
        methods = Counter(_method_for_progress(p) for p in due)
        # Replace any unread reminder from today for this user with the fresh one.
        today = timezone.localdate()
        Reminder.objects.filter(
            user=user, kind=Reminder.KIND_REVIEW, read_at__isnull=True,
            created_at__date=today,
        ).delete()
        Reminder.objects.create(
            user=user,
            kind=Reminder.KIND_REVIEW,
            subject=f"You have {total} review item{'s' if total != 1 else ''} due",
            payload={"count": total, "methods": dict(methods)},
        )
        made += 1
        logger.info("[generate_reminders] user=%s due=%s", user.id, total)
    return {"reminders_created": made}