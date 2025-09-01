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
from typing import List, Optional, Iterable, Dict, Any, Tuple
import math
import re

try:  # spaCy optional at this stage (tests can patch)
    import spacy  # type: ignore
except Exception:  # pragma: no cover
    spacy = None  # type: ignore

from API.models import Document, Cloze
import logging

logger = logging.getLogger(__name__)


_NLP_CACHE: Dict[str, Any] = {}


def get_nlp(lang: str = "es"):
    """Lazy load and cache spaCy model.
    Attempts to load installed model (e.g. 'es_core_news_md'); falls back to blank pipeline.
    Safe to call multiple times; returns same object instance per language.
    """
    if lang in _NLP_CACHE:
        return _NLP_CACHE[lang]
    if spacy is None:  # library not available
        logger.warning("spaCy not installed; returning None for NLP model %s", lang)
        return None
    preferred_models = {
        "es": ["es_core_news_md", "es_core_news_sm"],
        "en": ["en_core_web_md", "en_core_web_sm"],
    }
    model_names = preferred_models.get(lang, [])
    nlp_obj = None
    for name in model_names:
        try:
            nlp_obj = spacy.load(name)  # type: ignore
            logger.info("Loaded spaCy model '%s' for lang=%s", name, lang)
            break
        except Exception:
            continue
    if nlp_obj is None:
        # fallback blank
        try:
            nlp_obj = spacy.blank(lang)  # type: ignore
            logger.info("Using blank spaCy pipeline for lang=%s", lang)
        except Exception:
            logger.error("Failed to create blank spaCy model for lang=%s", lang)
            return None
    _NLP_CACHE[lang] = nlp_obj
    return nlp_obj


Candidate = Dict[str, Any]


def simple_token_filter(token_text: str) -> bool:
    """Basic token acceptance filter (language agnostic-ish).
    Reject very short, numeric, punctuation-like tokens.
    """
    if len(token_text) < 3:
        return False
    if token_text.isdigit():
        return False
    if re.fullmatch(r"[\W_]+", token_text):
        return False
    return True


def compute_frequency_scores(words: Iterable[str]) -> Dict[str, float]:
    freq: Dict[str, int] = {}
    for w in words:
        if not simple_token_filter(w):
            continue
        k = w.lower()
        freq[k] = freq.get(k, 0) + 1
    if not freq:
        return {}
    max_f = max(freq.values())
    return {w: c / max_f for w, c in freq.items()}


def extract_candidates(text: str, nlp=None, limit: int = 100) -> List[Candidate]:
    """Return raw candidate spans with naive scoring inputs.
    Works even if spaCy model isn't available (falls back to regex word extraction).
    """
    if not text:
        return []
    doc = None
    if nlp is not None:
        try:
            doc = nlp(text)
        except Exception:  # pragma: no cover - safety
            doc = None
    tokens: List[str] = []
    spans: List[Tuple[int, int, str]] = []  # (start_char, end_char, text)
    if doc is not None:
        for t in doc:
            if not t.text.strip():
                continue
            if not simple_token_filter(t.text):
                continue
            tokens.append(t.text)
        # entities first (higher semantic value)
        ent_set = set()
        if getattr(doc, "ents", None):
            for ent in doc.ents:
                key = (ent.start_char, ent.end_char)
                if key in ent_set:
                    continue
                ent_set.add(key)
                spans.append((ent.start_char, ent.end_char, ent.text))
        # noun chunks
        if hasattr(doc, "noun_chunks"):
            try:
                for chunk in doc.noun_chunks:  # type: ignore
                    key = (chunk.start_char, chunk.end_char)
                    if key in ent_set:
                        continue
                    span_text = chunk.text.strip()
                    if simple_token_filter(span_text):
                        spans.append((chunk.start_char, chunk.end_char, span_text))
            except Exception:  # pragma: no cover
                pass
    else:
        # Fallback: use word regex as crude tokens
        for m in re.finditer(r"\b\w{3,}\b", text, flags=re.UNICODE):
            word = m.group(0)
            tokens.append(word)
            spans.append((m.start(), m.end(), word))

    freq_scores = compute_frequency_scores(tokens)
    candidates: List[Candidate] = []
    for start, end, span_text in spans:
        base = span_text.lower()
        score = 1.0 - freq_scores.get(base, 0.0) * 0.5  # rarer -> higher
        length_bonus = min(len(span_text) / 15.0, 1.0) * 0.2
        final_score = score + length_bonus
        candidates.append({
            "text": span_text,
            "start": start,
            "end": end,
            "score": round(final_score, 4),
        })
    # Deduplicate by text + position
    seen = set()
    unique: List[Candidate] = []
    for c in sorted(candidates, key=lambda x: x["score"], reverse=True):
        key = (c["start"], c["end"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)
        if len(unique) >= limit:
            break
    return unique


class ClozeGenerator:
    def __init__(self, document: Document, max_items: int = 10):
        self.document = document
        self.max_items = max_items

    def _select_base_candidates(self, text: str, nlp) -> List[Candidate]:
        return extract_candidates(text, nlp=nlp, limit=self.max_items * 4)

    def generate(self) -> List[Cloze]:  # pragma: no cover - still stub
        """Stub: will generate and persist Cloze items.
        Returns empty list for now.
        """
        return []


__all__ = [
    "ClozeGenerator",
    "get_nlp",
    "extract_candidates",
    "compute_frequency_scores",
]
