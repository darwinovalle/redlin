from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    SpaceViewSet,
    TopicViewSet,
    ColumnViewSet,
    CardViewSet,
    CardResourceViewSet,
    attempt_view,
    study_view,
    stats_view,
    reminders_due_view,
    reminders_list_view,
    reminder_read_view,
    feynman_session_view,
)

router = DefaultRouter()
router.register(r'spaces', SpaceViewSet, basename='space')
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'columns', ColumnViewSet, basename='column')
router.register(r'cards', CardViewSet, basename='card')
router.register(r'card-resources', CardResourceViewSet, basename='card-resource')

urlpatterns = router.urls + [
    path('attempts/', attempt_view, name='attempt'),
    path('study/', study_view, name='study'),
    path('stats/', stats_view, name='stats'),
    path('reminders/due/', reminders_due_view, name='reminders-due'),
    path('reminders/', reminders_list_view, name='reminders-list'),
    path('reminders/<int:pk>/read/', reminder_read_view, name='reminder-read'),
    path('study/feynman/', feynman_session_view, name='feynman-session'),
]
