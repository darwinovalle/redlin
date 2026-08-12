from django.contrib import admin
from django.urls import path
from django.urls.conf import include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from django.conf import settings

from redlin_web.media_serve import serve_media



urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/', include('API.urls')),
    path('api/classroom/', include('CLASSROOM.urls')),
    path('api/', include('CORE.urls')),
    path('api/', include('CSV.urls')),
    path('api/video/', include('VIDEO.urls')),
    # OpenAPI schema and docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Media files are served with HTTP Range support (needed for HTML5 <video>
# playback and seeking; Django's static() ignores Range headers).
urlpatterns += [
    path(f"{settings.MEDIA_URL.lstrip('/')}<path:path>", serve_media, name="media"),
]
