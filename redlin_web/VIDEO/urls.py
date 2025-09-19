from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import VideoViewSet, VideoSummaryViewSet, VideoMCQViewSet, VideoFeynmanViewSet

router = DefaultRouter()
router.register(r'videos', VideoViewSet, basename='video')
router.register(r'video-summaries', VideoSummaryViewSet, basename='video-summary')
router.register(r'video-mcqs', VideoMCQViewSet, basename='video-mcq')
router.register(r'video-feynman', VideoFeynmanViewSet, basename='video-feynman')

urlpatterns = [
    path('', include(router.urls)),
]