"""Lógica pura reutilizable para generación Cloze.

Separar del generador principal permite:
- Tests unitarios sin tocar ORM
- Mayor cobertura (menos ramas dependientes de IO)
- Reutilización futura (p.ej. para APIs streaming)
"""
from __future__ import annotations
from typing import List, Dict, Any, Iterable, Tuple
import re
import math

Candidate = Dict[str, Any]

# --- Token & frecuencia -----------------------------------------------------

def simple_token_filter(token_text: str) -> bool:
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

# --- Extracción candidatos --------------------------------------------------

def extract_candidates(text: str, nlp=None, limit: int = 100) -> List[Candidate]:
    if not text:
        return []
    doc = None
    if nlp is not None:
        try:
            doc = nlp(text)  # type: ignore
        except Exception:  # pragma: no cover
            doc = None
    tokens: List[str] = []
    spans: List[Tuple[int,int,str]] = []
    if doc is not None:
        for t in doc:  # type: ignore
            if not t.text.strip():
                continue
            if not simple_token_filter(t.text):
                continue
            tokens.append(t.text)
        ent_set = set()
        if getattr(doc, 'ents', None):
            for ent in doc.ents:  # type: ignore
                key = (ent.start_char, ent.end_char)
                if key in ent_set:
                    continue
                ent_set.add(key)
                spans.append((ent.start_char, ent.end_char, ent.text))
        if hasattr(doc, 'noun_chunks'):
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
        for m in re.finditer(r"\b\w{3,}\b", text, flags=re.UNICODE):
            word = m.group(0)
            tokens.append(word)
            spans.append((m.start(), m.end(), word))
    freq_scores = compute_frequency_scores(tokens)
    candidates: List[Candidate] = []
    for start, end, span_text in spans:
        base = span_text.lower()
        rarity = 1.0 - freq_scores.get(base, 0.0) * 0.5
        length_bonus = min(len(span_text) / 15.0, 1.0) * 0.2
        base_score = rarity + length_bonus
        candidates.append({
            'text': span_text,
            'start': start,
            'end': end,
            'base_score': round(base_score,4),
            'score': round(base_score,4),
        })
    seen = set()
    unique: List[Candidate] = []
    for c in sorted(candidates, key=lambda x: x['score'], reverse=True):
        key = (c['start'], c['end'])
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)
        if len(unique) >= limit:
            break
    return unique

# --- Scoring extra ----------------------------------------------------------

def apply_entity_pos_scoring(candidates: List[Candidate], text: str, nlp) -> None:
    if not candidates:
        return
    doc = None
    if nlp is not None:
        try:
            doc = nlp(text)
        except Exception:  # pragma: no cover
            doc = None
    ent_index = {}
    if doc is not None:
        ent_index = {(e.start_char, e.end_char): e.label_ for e in getattr(doc,'ents', [])}
    POS_WEIGHTS = {'PROPN':0.35,'NOUN':0.25,'VERB':0.15,'NUM':0.10}
    for c in candidates:
        bonus = 0.0
        if (c['start'], c['end']) in ent_index:
            bonus += 0.4
            c['entity_label'] = ent_index[(c['start'], c['end'])]
        if doc is not None:
            try:
                span_tokens = [t for t in doc if t.idx >= c['start'] and t.idx + len(t.text) <= c['end']]
                if span_tokens:
                    pos = span_tokens[0].pos_  # type: ignore
                    c['pos'] = pos
                    bonus += POS_WEIGHTS.get(pos, 0.0)
            except Exception:  # pragma: no cover
                pass
        c['score'] = round(c['base_score'] + bonus, 4)

# --- Selección diversa ------------------------------------------------------

def diverse_select(candidates: List[Candidate], limit: int, nlp=None, text: str="") -> List[Candidate]:
    selected: List[Candidate] = []
    seen = set()
    lemma_map = {}
    doc = None
    if nlp is not None and text:
        try:
            doc = nlp(text)
        except Exception:  # pragma: no cover
            doc = None
    if doc is not None:
        for t in doc:  # type: ignore
            lemma_map[(t.idx, t.idx+len(t.text))] = (t.lemma_ or t.text).lower()
    for c in sorted(candidates, key=lambda x: x['score'], reverse=True):
        key = c['text'].lower()
        if doc is not None:
            key = lemma_map.get((c['start'], c['end']), key)
        if key in seen:
            continue
        seen.add(key)
        selected.append(c)
        if len(selected) >= limit:
            break
    return selected

# --- Distractores -----------------------------------------------------------

def build_distractors(answer: str, base_candidates: List[Candidate], cand: Candidate, nlp=None, count: int = 3) -> List[str]:
    answer_lower = answer.lower()
    distractors: List[str] = []
    pos = cand.get('pos')
    entity_label = cand.get('entity_label')
    pool: List[str] = []
    for c in base_candidates:
        txt = c['text']
        if txt.lower() == answer_lower:
            continue
        if entity_label and c.get('entity_label') != entity_label:
            continue
        if pos and c.get('pos') != pos:
            continue
        if len(txt.split()) > 4:
            continue
        pool.append(txt)
    if len(pool) < count:
        for c in base_candidates:
            txt = c['text']
            if txt.lower() == answer_lower or txt in pool:
                continue
            if len(txt) < 3 or len(txt.split()) > 5:
                continue
            pool.append(txt)
            if len(pool) >= count*4:
                break
    import random
    random.shuffle(pool)
    for p in pool:
        if p.lower() == answer_lower:
            continue
        if p not in distractors:
            distractors.append(p)
        if len(distractors) >= count:
            break
    if len(distractors) < count and answer.isdigit():
        base_num = int(answer)
        for d in [1,2,5,10]:
            variant = str(base_num + d)
            if variant != answer and variant not in distractors:
                distractors.append(variant)
            if len(distractors) >= count:
                break
    return distractors

__all__ = [
    'simple_token_filter', 'compute_frequency_scores', 'extract_candidates',
    'apply_entity_pos_scoring', 'diverse_select', 'build_distractors'
]
