"""DEPRECATED: compatibility facade for legacy imports.

Deprecated in Phase 4.1. Internal modules must import from `API.services.*`
directly instead of this facade.

The original task_2 module held the full document-processing monolith.
Phase 3 moved implementation into dedicated services while preserving the
same public symbols for external compatibility.
"""

from .services.cloze_generation_service import generate_ai_clozes
from .services.document_processing_service import process_pdf
from .services.feynman_generation_service import generate_ai_feynman
from .services.processing_common import detect_language, extract_json_block, generate_with_retry


# Keep old private symbol name for backward compatibility (used by feynman_ai.py).
def _extract_json_block(text: str, key_hint: str) -> str | None:
    return extract_json_block(text, key_hint)


__all__ = [
    "detect_language",
    "generate_with_retry",
    "generate_ai_clozes",
    "generate_ai_feynman",
    "process_pdf",
    "_extract_json_block",
]
