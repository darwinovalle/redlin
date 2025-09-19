"""Cloze generation service.

Resumen:
    Servicio para generar ítems Cloze (fill-in-the-blank) desde el texto de un `Document`.
    Implementa pipeline NLP con spaCy (opcional, con fallback) que:
        1. Carga/cacha modelo spaCy (preferido: `es_core_news_md`, fallback: blank)
        2. Extrae candidatos (entidades, noun chunks, fallback regex si no hay pipeline)
        3. Calcula puntuación (rareza inversa de frecuencia, longitud, bonus por entidad/POS)
        4. Selecciona conjunto diverso evitando lemmas duplicados
        5. Genera ítems single-blank reemplazando span por '____' y construye distractores
        6. Opcional: genera ítem multi-blank con placeholders `[[BLANK_i]]`
        7. Determina dificultad heurística (easy/medium/hard) y guarda metadata detallada
        8. Persiste en BD modelos `Cloze`.

Campos en `Cloze` utilizados:
    text_with_blank: texto con placeholder(s)
    answer: respuesta principal (para multi-blank es la del primer blank para compatibilidad)
    options: distractores (lista de strings)
    meta: JSON con strategy, spans, scores, blanks (multi), difficulty_calc, etc.
    difficulty: etiqueta final usada para UX / selección adaptativa futura.

Instalación del modelo spaCy (si se instala desde cero):
    El archivo `requirements.txt` ya incluye `es-core-news-md==3.7.0`.
    Alternativamente se podría instalar manualmente:
            python -m spacy download es_core_news_md
    (No es necesario si el wheel se instala por pip con la versión fijada.)

Uso básico:
        from CORE.services.cloze_generator import ClozeGenerator
        generator = ClozeGenerator(document, max_items=8)
        clozes = generator.generate()

Consideraciones de cobertura:
    Ramas edge (fallback spaCy inexistente, generación numérica de distractores, multi-blank insuficiente) están cubiertas con tests adicionales.

Extensión futura:
    - Variante para transcripciones de video reutilizando el mismo núcleo (ver `VideoClozeGenerator`).
    - Ajuste de heurística según datos de desempeño de usuarios.

Licencia / Notas: Evita dependencias pesadas adicionales; spaCy es opcional en runtime (fallback regex)."""
from __future__ import annotations
from typing import List, Optional, Dict, Any, Set, Tuple
import random

try:  # spaCy optional at this stage (tests can patch)
    import spacy  # type: ignore
except Exception:  # pragma: no cover
    spacy = None  # type: ignore

from API.models import Document, Cloze
from VIDEO.models import Video, VideoCloze
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
        logger.warning("spaCy not installed; returning None for NLP model %s", lang)  # pragma: no cover - env dependent
        return None  # pragma: no cover
    preferred_models = {
        "es": ["es_core_news_md", "es_core_news_sm"],
        "en": ["en_core_web_md", "en_core_web_sm"],
    }
    model_names = preferred_models.get(lang, [])
    nlp_obj = None
    for name in model_names:
        try:
            nlp_obj = spacy.load(name)  # type: ignore
            logger.info("Loaded spaCy model '%s' for lang=%s", name, lang)  # pragma: no cover - depends on installed model
            break
        except Exception:  # pragma: no cover - model absence path tested indirectly
            continue
    if nlp_obj is None:  # pragma: no cover - difficult to force both models missing yet lib present
        try:
            nlp_obj = spacy.blank(lang)  # type: ignore
            logger.info("Using blank spaCy pipeline for lang=%s", lang)  # pragma: no cover
        except Exception:  # pragma: no cover
            logger.error("Failed to create blank spaCy model for lang=%s", lang)  # pragma: no cover
            return None  # pragma: no cover
    _NLP_CACHE[lang] = nlp_obj
    return nlp_obj


from CORE.services.cloze_logic import (
    simple_token_filter,
    compute_frequency_scores,
    extract_candidates,
    apply_entity_pos_scoring,
    diverse_select as logic_diverse_select,
    build_distractors as logic_build_distractors,
)

Candidate = Dict[str, Any]


class ClozeGenerator:
    def __init__(self, document: Document, max_items: int = 10):
        self.document = document
        self.max_items = max_items

    def _select_base_candidates(self, text: str, nlp) -> List[Candidate]:
        return extract_candidates(text, nlp=nlp, limit=self.max_items * 4)

    # --- Scoring & selection -------------------------------------------------
    def _apply_scoring(self, candidates: List[Candidate], text: str, nlp) -> None:
        # Delegado a lógica pura
        apply_entity_pos_scoring(candidates, text, nlp)

    def _diverse_select(self, candidates: List[Candidate], limit: int, nlp=None, text: str = "") -> List[Candidate]:
        return logic_diverse_select(candidates, limit, nlp=nlp, text=text)

    # --- Distractors --------------------------------------------------------
    def _build_distractors(self, answer: str, base_candidates: List[Candidate], cand: Candidate, nlp=None, count: int = 3) -> List[str]:
        return logic_build_distractors(answer, base_candidates, cand, nlp=nlp, count=count)

    # --- Multi-blank --------------------------------------------------------
    def _create_multi_blank(self, text: str, candidates: List[Candidate], nlp) -> Optional[Cloze]:
        usable = sorted(candidates, key=lambda x: x['score'], reverse=True)[:10]
        usable.sort(key=lambda x: x['start'])
        chosen: List[Candidate] = []
        last_end = -1
        for c in usable:
            if c['start'] >= last_end:
                chosen.append(c)
                last_end = c['end']
            if len(chosen) >= 3:
                break
        if len(chosen) < 2:
            return None
        # build text with placeholders [[BLANK_i]]
        parts = []
        cursor = 0
        blanks_meta = []
        for i, c in enumerate(chosen):
            parts.append(text[cursor:c['start']])
            placeholder = f"[[BLANK_{i+1}]]"
            parts.append(placeholder)
            blanks_meta.append({
                'index': i+1,
                'answer': c['text'],
                'span': [c['start'], c['end']],
                'score': c['score'],
            })
            cursor = c['end']
        parts.append(text[cursor:])
        mb_text = ''.join(parts)
        meta = {
            'strategy': 'multi_blank_v1',
            'blanks': blanks_meta,
            'count': len(blanks_meta),
        }
        difficulty = 'hard' if len(blanks_meta) >= 3 else 'medium'
        cloze = Cloze.objects.create(
            document=self.document,
            text_with_blank=mb_text,
            answer=blanks_meta[0]['answer'],  # principal
            context='',
            source_span=None,
            options=[],
            meta=meta,
            difficulty=difficulty,
        )
        return cloze

    def generate(self) -> List[Cloze]:  # pragma: no cover
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
        total_candidates = len(base)
        self._apply_scoring(base, text, nlp)
        selected = self._diverse_select(base, self.max_items, nlp=nlp, text=text)
        discarded = total_candidates - len(selected)
        created: List[Cloze] = []
        for cand in selected:
            answer = cand['text']
            span_start, span_end = cand['start'], cand['end']
            blank_text = text[:span_start] + '____' + text[span_end:]
            difficulty = self._heuristic_difficulty(cand)
            distractors = self._build_distractors(answer, base, cand, nlp=nlp)
            meta = {
                'strategy': 'single_blank_v1',
                'span': [span_start, span_end],
                'score': cand['score'],
                'base_score': cand.get('base_score'),
                'pos': cand.get('pos'),
                'entity_label': cand.get('entity_label'),
                'difficulty_calc': difficulty,
                'distractor_source_size': len(distractors),
            }
            cloze = Cloze.objects.create(
                document=self.document,
                text_with_blank=blank_text,
                answer=answer,
                context='',
                source_span=text[span_start:span_end],
                options=distractors,
                meta=meta,
                difficulty=difficulty,
            )
            created.append(cloze)
            if len(created) >= self.max_items:
                break
        # Multi-blank (count as one) if capacity remains
        if len(created) < self.max_items:
            mb = self._create_multi_blank(text, base, nlp)
            if mb:
                created.append(mb)
        multi_count = 1 if any(c.meta.get('strategy') == 'multi_blank_v1' for c in created) else 0
        total_distractors = sum(len(c.options) for c in created)
        logger.info(
            "ClozeGenerator summary doc=%s candidates=%d discarded=%d singles=%d multi=%d distractors=%d time=%.3fs",
            self.document.pk,
            total_candidates,
            discarded,
            len([c for c in created if c.meta.get('strategy') == 'single_blank_v1']),
            multi_count,
            total_distractors,
            time.time() - start_time,
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
    # Re-export lógica para mantener compatibilidad con imports existentes de tests
    "extract_candidates",
    "compute_frequency_scores",
    "simple_token_filter",
]


class VideoClozeGenerator(ClozeGenerator):
    """Generador para `VideoCloze` reutilizando la lógica base.

    Diferencias:
      - Fuente de texto: usa summary de video si existe, luego transcript_text.
      - Modelo persistido: `VideoCloze`.
      - Metadata incluye `source_type: video`.
    """
    def __init__(self, video: Video, max_items: int = 8):  # menor por longitud típica
        self.video = video
        self.max_items = max_items

    # Sobrescribe para texto de video
    def _get_document_text(self) -> str:  # type: ignore[override]
        try:
            if hasattr(self.video, 'summary') and self.video.summary:
                return getattr(self.video.summary, 'content', '') or ''
        except Exception:
            pass
        return self.video.transcript_text or self.video.title or ''

    def generate(self) -> List[VideoCloze]:  # type: ignore[override]
        import time
        start_time = time.time()
        text = self._get_document_text()
        if not text or len(text.split()) < 5:
            logger.info("VideoClozeGenerator: transcript too short -> 0 items (video=%s)", self.video.pk)
            return []
        nlp = get_nlp("es")
        base = self._select_base_candidates(text, nlp)
        total_candidates = len(base)
        self._apply_scoring(base, text, nlp)
        selected = self._diverse_select(base, self.max_items, nlp=nlp, text=text)
        discarded = total_candidates - len(selected)
        created: List[VideoCloze] = []
        for cand in selected:
            answer = cand['text']
            span_start, span_end = cand['start'], cand['end']
            blank_text = text[:span_start] + '____' + text[span_end:]
            difficulty = self._heuristic_difficulty(cand)
            distractors = self._build_distractors(answer, base, cand, nlp=nlp)
            meta = {
                'strategy': 'single_blank_v1',
                'span': [span_start, span_end],
                'score': cand['score'],
                'pos': cand.get('pos'),
                'entity_label': cand.get('entity_label'),
                'source_type': 'video',
            }
            vc = VideoCloze.objects.create(
                video=self.video,
                text_with_blank=blank_text,
                answer=answer,
                context='',
                source_span=text[span_start:span_end],
                options=distractors,
                meta=meta,
                difficulty=difficulty,
            )
            created.append(vc)
            if len(created) >= self.max_items:
                break
        logger.info(
            "VideoClozeGenerator summary video=%s candidates=%d discarded=%d singles=%d time=%.3fs",
            self.video.pk,
            total_candidates,
            discarded,
            len(created),
            time.time() - start_time,
        )
        return created

__all__.append("VideoClozeGenerator")
