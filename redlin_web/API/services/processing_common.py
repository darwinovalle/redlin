import os
import random
import re
import time

import google.generativeai as genai
from dotenv import load_dotenv


load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
# Keep model choice aligned with the previous pipeline behavior.
MODEL = genai.GenerativeModel("gemini-2.5-flash")

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


def _parse_retry_delay_seconds(error_message: str) -> int | None:
    """Try to extract retry_delay seconds from Gemini error string."""
    try:
        match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_message)
        if match:
            return int(match.group(1))
    except Exception:
        pass
    return None


def generate_with_retry(prompt: str, *, max_attempts: int = 3, base_wait: int = 5):
    """Call Gemini generate_content with backoff for 429/quota errors."""
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return MODEL.generate_content(prompt)
        except Exception as exc:
            message = str(exc)
            if "429" in message or "quota" in message.lower() or "rate" in message.lower():
                suggested = _parse_retry_delay_seconds(message)
                wait = suggested if suggested is not None else min(60, base_wait * (2 ** (attempt - 1)))
                wait = int(wait + random.uniform(0, 0.2) * wait)
                print(f"[RateLimit] Attempt {attempt}/{max_attempts} failed. Waiting {wait}s before retry.")
                time.sleep(wait)
                last_exc = exc
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("Generation failed without exception detail")


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
