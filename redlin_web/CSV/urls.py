from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import CSVImportViewSet, CSVFlashcardViewSet

router = DefaultRouter()
router.register(r'csv/imports', CSVImportViewSet, basename='csv-import')
router.register(r'csv/flashcards', CSVFlashcardViewSet, basename='csv-flashcard')

urlpatterns = [
    path('', include(router.urls)),
]
