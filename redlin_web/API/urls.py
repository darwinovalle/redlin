from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views_auth import login, register, refresh_token, whoami
from .views_documents import UserViewSet, DocumentViewSet, get_user_documents
from .views_learning import SummaryViewSet, FlashcardViewSet, MCQViewSet, ClozeViewSet, FeynmanViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'summaries', SummaryViewSet, basename='summary')
router.register(r'flashcards', FlashcardViewSet, basename='flashcard')
router.register(r'mcqs', MCQViewSet, basename='mcq')
router.register(r'cloze', ClozeViewSet, basename='cloze')
router.register(r'feynman', FeynmanViewSet, basename='feynman')

urlpatterns = [
    path('documents/user/<int:user_id>/', get_user_documents, name='user-documents'),
    path('auth/login/', login, name='login'),
    path('auth/register/', register, name='register'),
    path('auth/refresh/', refresh_token, name='token-refresh'),
    path('auth/whoami/', whoami, name='whoami'),
    path('', include(router.urls)),
]