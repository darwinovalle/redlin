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