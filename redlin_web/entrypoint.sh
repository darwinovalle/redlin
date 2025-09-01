#!/bin/sh
set -e

# Para bases de datos externas solo si lo necesitas (Postgres/MySQL):
# export DJANGO_WAIT_FOR_DB=1 DB_HOST=db DB_PORT=5432 y se activará este bloque.
if [ "${DJANGO_WAIT_FOR_DB}" = "1" ]; then
  HOST="${DB_HOST:-db}"
  PORT="${DB_PORT:-5432}"
  echo "Waiting for ${HOST}:${PORT}..."
  until python - <<PY
import socket, sys
s = socket.socket()
try:
    s.connect(("${HOST}", int("${PORT}")))
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
  do
    echo "DB not ready, retrying..."
    sleep 1
  done
fi

# Migraciones (válido para SQLite)
python manage.py migrate

# Collectstatic solo si se indica (evita error en dev cuando STATIC_ROOT no está definido)
if [ "${DJANGO_COLLECTSTATIC}" = "1" ]; then
  python manage.py collectstatic --noinput
fi

# Si el primer argumento es 'celery', ejecutar Celery directamente (worker o beat)
if [ "$1" = "celery" ]; then
  shift
  echo "Launching Celery: celery $@"
  exec celery "$@"
fi

# Levanta el servidor de desarrollo por defecto
exec python manage.py runserver 0.0.0.0:8000
