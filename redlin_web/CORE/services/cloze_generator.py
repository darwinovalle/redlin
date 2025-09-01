"""Cloze generation service (skeleton).

Pipeline (future):
1. Process text with spaCy
2. Extract candidates (entities, noun chunks, keywords)
3. Score & select diverse set
4. Build blanks (single or multi) and distractors
5. Persist Cloze records

Current minimal stub returns empty list (placeholder for tests TDD approach).
"""
from __future__ import annotations
from typing import List, Optional

try:  # spaCy optional at this stage (tests can patch)
    import spacy  # type: ignore
except Exception:  # pragma: no cover
    spacy = None  # type: ignore

from API.models import Document, Cloze


def get_nlp(lang: str = "es"):
    """Lazy load and cache spaCy model.
    For now we return None if spaCy not installed; logic will be expanded later.
    """
    # TODO: implement global cache and model loading (Issue #11)
    if spacy is None:
        return None
    try:
        return spacy.blank(lang)  # placeholder until real model added
    except Exception:
        return None


class ClozeGenerator:
    def __init__(self, document: Document, max_items: int = 10):
        self.document = document
        self.max_items = max_items

    def generate(self) -> List[Cloze]:
        """Stub: will generate and persist Cloze items.
        Returns empty list for now.
        """
        return []


__all__ = ["ClozeGenerator", "get_nlp"]
