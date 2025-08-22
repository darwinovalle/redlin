from __future__ import annotations
from urllib.parse import urlparse, parse_qs
import re
import os
import time
from typing import Iterable, Dict, Any, Optional, List
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

try:
    from youtube_transcript_api import TooManyRequests  # type: ignore
except Exception:
    class TooManyRequests(Exception):
        pass

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,}$")

class TranscriptError(Exception):
    pass

def _is_valid_id(val: str) -> bool:
    return "://" not in val and bool(_YT_ID_RE.match(val))

def _from_short(parsed) -> Optional[str]:
    if parsed.netloc in ("youtu.be", "www.youtu.be"):
        vid = parsed.path.lstrip("/")
        return vid if _is_valid_id(vid) else None
    return None

def _from_query(parsed) -> Optional[str]:
    if parsed.netloc.endswith("youtube.com"):
        qs = parse_qs(parsed.query)
        vid = qs.get("v", [None])[0]
        if vid and _is_valid_id(vid):
            return vid
    return None

def _from_embed(parsed) -> Optional[str]:
    if parsed.netloc.endswith("youtube.com"):
        parts = [p for p in parsed.path.split("/") if p]
        if "embed" in parts:
            try:
                vid = parts[parts.index("embed")+1]
                return vid if _is_valid_id(vid) else None
            except (ValueError, IndexError):
                return None
    return None

def extract_video_id(url_or_id: str) -> str:
    cand = url_or_id.strip()
    if _is_valid_id(cand):
        return cand
    try:
        parsed = urlparse(cand)
    except Exception as e:
        raise TranscriptError(f"URL inválida: {e}") from e
    for fn in (_from_short, _from_query, _from_embed):
        vid = fn(parsed)
        if vid:
            return vid
    raise TranscriptError("No se pudo extraer video_id")

def _should_retry(err: Exception, attempt: int, max_retries: int, debug: bool) -> bool:
    msg = str(err).lower()
    trans = "no element found" in msg or "timed out" in msg or "connection" in msg
    if debug:
        print(f"[Transcript DEBUG] intento {attempt}/{max_retries} error: {err} (transient={trans})")
    return trans and attempt < max_retries

def fetch_transcript(
    url_or_id: str,
    languages: Optional[Iterable[str]] = None,
    retries: int = 3,
    backoff: float = 1.5,
) -> Dict[str, Any]:
    debug = bool(os.getenv("TRANSCRIPT_DEBUG"))
    vid = extract_video_id(url_or_id)
    langs = list(languages) if languages else None
    api = YouTubeTranscriptApi()
    last_err = None
    for attempt in range(1, retries+1):
        try:
            fetched = api.fetch(vid, languages=langs) if langs else api.fetch(vid)
            snippets = [
                {"text": s.text, "start": s.start, "duration": s.duration}
                for s in fetched.snippets
            ]
            return {
                "video_id": getattr(fetched, "video_id", vid),
                "language": getattr(fetched, "language", langs[0] if langs else None),
                "language_code": getattr(fetched, "language_code", None),
                "is_generated": getattr(fetched, "is_generated", None),
                "snippets": snippets,
            }
        except (NoTranscriptFound, TranscriptsDisabled) as e:
            raise TranscriptError(f"No hay transcript disponible: {e}") from e
        except VideoUnavailable as e:
            raise TranscriptError("Video no disponible") from e
        except TooManyRequests as e:
            raise TranscriptError("Rate limit alcanzado") from e
        except Exception as e:
            last_err = e
            if _should_retry(e, attempt, retries, debug):
                time.sleep(backoff * attempt)
                continue
            raise TranscriptError(f"Error obteniendo transcript: {e}") from e
    raise TranscriptError(f"Error luego de reintentos: {last_err}")

def safe_fetch_transcript(url_or_id: str, languages: Optional[Iterable[str]] = None):
    try:
        return {"ok": True, "data": fetch_transcript(url_or_id, languages=languages), "error": None}
    except TranscriptError as e:
        return {"ok": False, "data": None, "error": str(e)}

if __name__ == "__main__":
    test_url = os.getenv("TEST_VIDEO_URL", "https://www.youtube.com/watch?v=Z6nkEZyS9nA")
    r = safe_fetch_transcript(test_url)
    if r["ok"]:
        print(f"Snippets obtenidos: {len(r['data']['snippets'])}")
        print("Primeros 3:", r["data"]["snippets"][:3])
    else:
        print("Error:", r["error"])
