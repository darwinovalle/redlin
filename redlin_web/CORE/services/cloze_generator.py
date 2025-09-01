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
from typing import List, Optional, Iterable, Dict, Any, Tuple, Set
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
        rarity = 1.0 - freq_scores.get(base, 0.0) * 0.5  # rarer -> closer to 1
        length_bonus = min(len(span_text) / 15.0, 1.0) * 0.2
        # entity / POS bonuses computed later if doc available; store raw parts
        base_score = rarity + length_bonus
        candidates.append({
            "text": span_text,
            "start": start,
            "end": end,
            "base_score": round(base_score, 4),
            "score": round(base_score, 4),  # may be updated
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

    # --- Scoring & selection -------------------------------------------------
    def _apply_scoring(self, candidates: List[Candidate], text: str, nlp) -> None:
        if not candidates:
            return
        doc = None
        if nlp is not None:
            try:
                doc = nlp(text)
            except Exception:
                doc = None
        ent_spans = []
        if doc is not None:
            ent_spans = [(e.start_char, e.end_char, e.label_) for e in getattr(doc, 'ents', [])]
        # Build quick index
        ent_index = {(s, e): label for s, e, label in ent_spans}
        POS_WEIGHTS = {
            'PROPN': 0.35,
            'NOUN': 0.25,
            'VERB': 0.15,
            'NUM': 0.10,
        }
        for c in candidates:
            bonus = 0.0
            if (c['start'], c['end']) in ent_index:
                bonus += 0.4  # entity bonus
                c['entity_label'] = ent_index[(c['start'], c['end'])]
            if doc is not None:
                # find token covering start
                try:
                    span_tokens = [t for t in doc if t.idx >= c['start'] and t.idx + len(t.text) <= c['end']]
                    if span_tokens:
                        head_pos = span_tokens[0].pos_  # type: ignore
                        bonus += POS_WEIGHTS.get(head_pos, 0.0)
                        c['pos'] = head_pos
                except Exception:
                    pass
            c['score'] = round(c['base_score'] + bonus, 4)

    def _diverse_select(self, candidates: List[Candidate], limit: int) -> List[Candidate]:
        selected: List[Candidate] = []
        seen_lemmas: Set[str] = set()
        for c in sorted(candidates, key=lambda x: x['score'], reverse=True):
            lemma_key = c['text'].lower()
            if lemma_key in seen_lemmas:
                continue
            seen_lemmas.add(lemma_key)
            selected.append(c)
            if len(selected) >= limit:
                break
        return selected

    def generate(self) -> List[Cloze]:  # pragma: no cover - still stub
        """Generate single-blank Cloze items from document text.
        Strategy v1: select diverse high-score candidates and replace span with '____'.
        Returns list of created Cloze objects (may be empty).
        """
        import time
        start_time = time.time()
        text = self._get_document_text()
        if not text or len(text.split()) < 5:
            logger.info("ClozeGenerator: text too short -> 0 items (doc=%s)", self.document_id if hasattr(self, 'document_id') else self.document.pk)
            return []
        nlp = get_nlp("es")
        base = self._select_base_candidates(text, nlp)
        self._apply_scoring(base, text, nlp)
        selected = self._diverse_select(base, self.max_items)
        created: List[Cloze] = []
        for cand in selected:
            answer = cand['text']
            span_start, span_end = cand['start'], cand['end']
            blank_text = text[:span_start] + '____' + text[span_end:]
            difficulty = self._heuristic_difficulty(cand)
            meta = {
                'strategy': 'single_blank_v1',
                'span': [span_start, span_end],
                'score': cand['score'],
                'base_score': cand.get('base_score'),
                'pos': cand.get('pos'),
                'entity_label': cand.get('entity_label'),
                'difficulty_calc': difficulty,
            }
            cloze = Cloze.objects.create(
                document=self.document,
                text_with_blank=blank_text,
                answer=answer,
                context='',
                source_span=text[span_start:span_end],
                options=[],
                meta=meta,
                difficulty=difficulty,
            )
            created.append(cloze)
        logger.info(
            "ClozeGenerator: created %d items (candidates=%d, selected=%d, time=%.3fs)",
            len(created), len(base), len(selected), time.time() - start_time
        )
        return created

    # --- Helpers ------------------------------------------------------------
    def _get_document_text(self) -> str:
        # Use related summary if exists; else try fallback attributes (title)
        try:
            if hasattr(self.document, 'summary') and self.document.summary:
                return getattr(self.document.summary, 'content', '') or ''
        except Exception:
            pass
        # No summary -> attempt attributes that might contain text (custom installs might have 'content')
        return getattr(self.document, 'content', '') or self.document.title or ''

    def _heuristic_difficulty(self, cand: Candidate) -> str:
        score = cand.get('score', 1.0)
        length = len(cand['text'])
        # Basic rule combining rarity+length+entity
        if cand.get('entity_label') and score >= 1.2:
            return 'hard'
        if length <= 5 and score < 0.9:
            return 'easy'
        if score > 1.3 or length > 12:
            return 'hard'
        if score < 0.85:
            return 'easy'
        return 'medium'


__all__ = [
    "ClozeGenerator",
    "get_nlp",
    "extract_candidates",
    "compute_frequency_scores",
]
