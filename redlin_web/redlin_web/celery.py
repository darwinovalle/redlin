import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "redlin_web.settings")

app = Celery("redlin_web")

# Read config from Django settings with CELERY_ prefix
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py in installed apps
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")

# Example periodic task schedule placeholder (extend later)
app.conf.beat_schedule = {
    'heartbeat-every-5-min': {
        'task': 'CORE.tasks.heartbeat',
        'schedule': crontab(minute='*/5'),
        'options': {'queue': 'default'}
    }
}
