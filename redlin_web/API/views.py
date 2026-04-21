"""DEPRECATED: API view compatibility facade.

Deprecated in Phase 4.1. Internal modules should import from
`API.views_auth`, `API.views_documents`, or `API.views_learning` directly.

This module re-exports viewsets and function-based views so existing imports
remain stable during the compatibility window.
"""

from .views_auth import login, refresh_token, register, whoami
from .views_documents import DocumentViewSet, UserViewSet, get_user_documents
from .views_learning import ClozeViewSet, FlashcardViewSet, FeynmanViewSet, MCQViewSet, SummaryViewSet

__all__ = [
    "UserViewSet",
    "DocumentViewSet",
    "SummaryViewSet",
    "FlashcardViewSet",
    "MCQViewSet",
    "ClozeViewSet",
    "FeynmanViewSet",
    "login",
    "register",
    "refresh_token",
    "whoami",
    "get_user_documents",
]
