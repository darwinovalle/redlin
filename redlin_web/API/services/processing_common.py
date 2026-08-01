import re

# Unified per-user LLM provider dispatch lives in llm_provider.py.
from .llm_provider import GeminiResponseMock, generate_with_retry

SPANISH_COMMON = {
    "el", "la", "de", "que", "y", "en", "a", "los", "se", "del",
    "las", "un", "por", "con", "una", "su", "para", "es", "al", "lo",
    "como", "mas", "más", "pero", "sus", "le",
}
ENGLISH_COMMON = {
    "the", "and", "to", "of", "in", "that", "it", "is", "for", "on",
    "as", "are", "was", "with", "this", "by", "an", "be", "or", "from",
}


def detect_language(text: str) -> str:
    """Light heuristic comparing counts of common function words."""
    if not text:
        return "other"
    words = re.findall(r"[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+", text.lower())
    if not words:
        return "other"
    es_count = sum(1 for word in words if word in SPANISH_COMMON)
    en_count = sum(1 for word in words if word in ENGLISH_COMMON)
    if es_count >= 3 and es_count > en_count * 1.2:
        return "es"
    if en_count >= 3 and en_count > es_count * 1.2:
        return "en"
    return "other"


def extract_json_block(text: str, key_hint: str) -> str | None:
    """Extract the first balanced JSON object containing key_hint."""
    start_candidates = [match.start() for match in re.finditer(r"\{", text)]
    for start in start_candidates:
        if key_hint not in text[start:]:
            continue
        depth = 0
        for index, ch in enumerate(text[start:], start=start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:index + 1].strip()
                    if key_hint in candidate:
                        return candidate
                    break
    return None
