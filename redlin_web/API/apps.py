from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'API'

    def ready(self):
        # Register drf-spectacular extensions (e.g., JWT auth scheme)
        try:
            from . import openapi  # noqa: F401
        except Exception:
            # If extension import fails, don't block app startup
            pass
