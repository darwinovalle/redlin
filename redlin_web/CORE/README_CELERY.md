# Celery & Redis Setup (Issue #6)

## Servicios
- Redis: cola y backend de resultados (`redis://redis:6379/0`)
- Worker: `celery -A redlin_web worker -l info`
- Beat: `celery -A redlin_web beat -l info`

## Comandos útiles
```bash
# Levantar stack (backend + redis + worker + beat + frontend)
docker compose up --build

# Solo worker
docker compose up worker

# Abrir shell Celery para inspección
docker compose exec worker celery -A redlin_web inspect active

# Forzar ejecución manual de tarea debug
docker compose exec backend python manage.py shell -c "from redlin_web.celery import app; app.send_task('CORE.tasks.heartbeat')"
```

## Archivos clave
- `redlin_web/celery.py`: config principal
- `redlin_web/redlin_web/__init__.py`: auto-carga de app Celery
- `CORE/tasks.py`: tareas base (heartbeat, recalculate_daily_metrics)
- `docker-compose.yml`: servicios `redis`, `worker`, `beat`
- `settings.py`: variables `CELERY_*` y `REDIS_*`

## Próximos pasos
1. Definir colas separadas (e.g. `high`, `low`, `analytics`).
2. Añadir métricas / monitor (Flower o Prometheus exporter).
3. Programar tareas reales (XP diario, limpieza, recordatorios).
4. Añadir pruebas unitarias con `CELERY_TASK_ALWAYS_EAGER` en tests.
