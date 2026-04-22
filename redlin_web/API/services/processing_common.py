import os
import re
import ollama

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
# Keep model choice aligned with the previous pipeline behavior.
MODEL = genai.GenerativeModel("gemini-2.5-pro")

# Ollama configuration - use environment variable or default
# For Linux: set OLLAMA_HOST=http://172.17.0.1:11434 (host IP on docker0 bridge)
# For Docker Desktop (Mac/Windows): uses host.docker.internal
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b-cloud")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")

class GeminiResponseMock:
    """Mock response object to maintain compatibility with Gemini's .text attribute."""
    def __init__(self, text: str):
        self.text = text

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


def _generate_with_ollama(prompt: str) -> str:
    """Fallback generator using local Ollama instance."""
    client = ollama.Client(host=OLLAMA_HOST)
    try:
        response = client.generate(model=OLLAMA_MODEL, prompt=prompt)
        return response['response']
    except Exception as e:
        print(f"[OllamaFallback] Local generation failed: {e}")
        raise

def generate_with_retry(prompt: str, *, max_attempts: int = 3, base_wait: int = 5):
    """Try Gemini once, then immediately fallback to Ollama if Gemini fails."""
    try:
        return MODEL.generate_content(prompt)
    except Exception as gemini_exc:
        print("[Fallback] Gemini failed on first attempt. Trying Ollama immediately...")
        try:
            result = _generate_with_ollama(prompt)
            return GeminiResponseMock(result)
        except Exception as ollama_exc:
            print("[Critical] Both Gemini and Ollama failed.")
            raise RuntimeError("Gemini failed, and Ollama fallback also failed") from ollama_exc


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
