from rest_framework.routers import DefaultRouter
from .views import (
    SpaceViewSet,
    TopicViewSet,
    ColumnViewSet,
    CardViewSet,
    CardResourceViewSet,
)

router = DefaultRouter()
router.register(r'spaces', SpaceViewSet, basename='space')
router.register(r'topics', TopicViewSet, basename='topic')
router.register(r'columns', ColumnViewSet, basename='column')
router.register(r'cards', CardViewSet, basename='card')
router.register(r'card-resources', CardResourceViewSet, basename='card-resource')

urlpatterns = router.urls
