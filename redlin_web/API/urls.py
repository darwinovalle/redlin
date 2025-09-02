from rest_framework.routers import DefaultRouter
from .views import UserViewSet, DocumentViewSet, SummaryViewSet, FlashcardViewSet, MCQViewSet, ClozeViewSet
from django.urls import path, include
from .views import login, register, get_user_documents, refresh_token, whoami

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'summaries', SummaryViewSet, basename='summary')
router.register(r'flashcards', FlashcardViewSet, basename='flashcard')
router.register(r'mcqs', MCQViewSet, basename='mcq')
router.register(r'cloze', ClozeViewSet, basename='cloze')

urlpatterns = [
    path('documents/user/<int:user_id>/', get_user_documents, name='user-documents'),
    path('auth/login/', login, name='login'),
    path('auth/register/', register, name='register'),
    path('auth/refresh/', refresh_token, name='token-refresh'),
    path('auth/whoami/', whoami, name='whoami'),
    path('', include(router.urls)),
]