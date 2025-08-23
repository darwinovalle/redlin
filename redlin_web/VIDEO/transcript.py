from __future__ import annotations
import os, re, time
from urllib.parse import urlparse, parse_qs
from typing import Iterable, Dict, Any, Optional
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)
try:
    from youtube_transcript_api import TooManyRequests  # type: ignore
except Exception:
    class TooManyRequests(Exception): ...

class TranscriptError(Exception): ...

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,}$")

def _is_valid_id(v: str) -> bool:
    return "://" not in v and bool(_YT_ID_RE.match(v))

def extract_video_id(s: str) -> str:
    s = s.strip()
    if _is_valid_id(s): return s
    try:
        p = urlparse(s)
    except Exception as e:
        raise TranscriptError(f"URL inválida: {e}") from e
    if p.netloc in ("youtu.be","www.youtu.be"):
        vid = p.path.lstrip("/")
        if _is_valid_id(vid): return vid
    if p.netloc.endswith("youtube.com"):
        qs = parse_qs(p.query)
        vid = qs.get("v",[None])[0]
        if vid and _is_valid_id(vid): return vid
        parts=[x for x in p.path.split("/") if x]
        if "embed" in parts:
            try:
                vid = parts[parts.index("embed")+1]
                if _is_valid_id(vid): return vid
            except Exception: pass
    raise TranscriptError("No se pudo extraer video_id")

_SP = {"el","la","de","que","y","en","a","los","se","del","las","un","por","con","una","su","para","es","al","lo","como","más","pero","sus","le"}
_EN = {"the","and","to","of","in","that","it","is","for","on","as","are","was","with","this","by","an","be","or","from"}

def _guess_lang(text: str) -> str:
    words = re.findall(r"[a-záéíóúüñ]+", text.lower())
    if not words: return "other"
    es = sum(1 for w in words if w in _SP)
    en = sum(1 for w in words if w in _EN)
    if es >= 3 and es > en * 1.2: return "es"
    if en >= 3 and en > es * 1.2: return "en"
    return "other"

def _should_retry(err: Exception, attempt: int, max_r: int, debug: bool) -> bool:
    transient = any(k in str(err).lower() for k in ("timed out","connection","temporarily"))
    if debug:
        print(f"[Transcript DEBUG] intento {attempt}/{max_r} transient={transient} err={err}")
    return transient and attempt < max_r

def _choose_transcript(video_id: str, requested_roots: set[str], debug: bool):
    """
    Usa instancia YouTubeTranscriptApi (v1.2.2 expone métodos de instancia: .list, .fetch)
    Selección:
      1. Match de raíz solicitado (prefiere manual sobre generado)
      2. Luego primer manual
      3. Luego primer generado
    """
    api = YouTubeTranscriptApi()
    transcripts = api.list(video_id)          # <-- antes se llamaba como método de clase
    all_ts = list(transcripts)
    if debug:
        print(f"[Transcript] encontrados {len(all_ts)} transcripts")
    def root(t): return (t.language_code or "").split("-")[0]
    matches = [t for t in all_ts if requested_roots and root(t) in requested_roots]
    if matches:
        matches.sort(key=lambda t: (t.is_generated, len(t.language_code or "")))
        return matches[0]
    manual = [t for t in all_ts if not t.is_generated]
    if manual:
        return manual[0]
    if all_ts:
        return all_ts[0]
    raise NoTranscriptFound(video_id, tuple(requested_roots), transcripts)


def _segments_to_dicts(segments):
    """
    Normaliza la lista de segmentos a una lista de dicts:
    Maneja objetos FetchedTranscriptSnippet (v1.2.2) o dicts.
    """
    out = []
    for s in segments:
        if isinstance(s, dict):
            out.append({
                "text": s.get("text", ""),
                "start": s.get("start", 0.0),
                "duration": s.get("duration", 0.0),
            })
        else:
            out.append({
                "text": getattr(s, "text", ""),
                "start": getattr(s, "start", 0.0),
                "duration": getattr(s, "duration", 0.0),
            })
    return out

def fetch_transcript(
    url_or_id: str,
    languages: Optional[Iterable[str]] = None,
    retries: int = 3,
    backoff: float = 1.5,
) -> Dict[str, Any]:
    """
    Obtiene transcript robusto (youtube-transcript-api 1.2.2 con métodos de instancia):
    1. list() para enumerar transcripts.
    2. Selecciona mejor transcript (_choose_transcript).
    3. Si se pidió 'en' y no es inglés y es traducible -> translate('en').
    4. Normaliza segmentos a dicts.
    5. Reintenta sólo ante errores transitorios configurados.
    """
    debug = bool(os.getenv("TRANSCRIPT_DEBUG"))
    vid = extract_video_id(url_or_id)
    requested_roots = {l.strip().lower().split("-")[0] for l in (languages or []) if l and l.strip()}

    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            chosen = _choose_transcript(vid, requested_roots, debug)
            base_lang_code = (getattr(chosen, "language_code", "") or "").lower()
            base_root = base_lang_code.split("-")[0] if base_lang_code else ""
            translated = False
            translated_from = None

            # Traducción a inglés si solicitada
            if "en" in requested_roots and base_root != "en" and getattr(chosen, "is_translatable", False):
                try:
                    chosen = chosen.translate("en")
                    translated = True
                    translated_from = base_lang_code
                    if debug:
                        print("[Transcript] traducido a en")
                except Exception as te:
                    if debug:
                        print(f"[Transcript] traducción falló: {te}")

            raw_segments = chosen.fetch()  # lista de FetchedTranscriptSnippet
            norm_segments = _segments_to_dicts(raw_segments)
            if not norm_segments:
                raise NoTranscriptFound(vid, tuple(requested_roots), None)

            full_text = " ".join(s["text"] for s in norm_segments)
            final_lang_code = getattr(chosen, "language_code", None) or _guess_lang(full_text)

            return {
                "video_id": vid,
                "language": getattr(chosen, "language", final_lang_code),
                "language_code": final_lang_code,
                "is_generated": getattr(chosen, "is_generated", True),
                "snippets": norm_segments,
                "translated": translated,
                "translated_from": translated_from,
            }

        except (TranscriptsDisabled, VideoUnavailable) as e:
            raise TranscriptError(str(e)) from e
        except TooManyRequests as e:
            last_err = e
            if attempt == retries:
                raise TranscriptError("Rate limit alcanzado") from e
            time.sleep(backoff * attempt)
        except NoTranscriptFound as e:
            last_err = e
            if attempt == retries:
                raise TranscriptError(f"No hay transcript disponible: {e}") from e
            time.sleep(backoff * attempt)
        except Exception as e:
            last_err = e
            if _should_retry(e, attempt, retries, debug):
                time.sleep(backoff * attempt)
            else:
                if attempt == retries:
                    raise TranscriptError(f"Error obteniendo transcript: {e}") from e
                time.sleep(backoff * attempt)

    raise TranscriptError(f"Error luego de reintentos: {last_err}")

def safe_fetch_transcript(url_or_id: str, languages: Optional[Iterable[str]] = None):
    try:
        return {"ok": True, "data": fetch_transcript(url_or_id, languages=languages), "error": None}
    except TranscriptError as e:
        return {"ok": False, "data": None, "error": str(e)}
