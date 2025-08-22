"""Transcript extraction via yt-dlp.

This module replaces the need for youtube-transcript-api when configured.
It downloads (without media) the auto or manual subtitles in JSON3 format
and converts them to a normalized structure compatible with the rest of
the video AI pipeline.

Return format (same shape expected by ai.process_video):
{
  "video_id": str,
  "language": str | None,          # heuristic language code (es/en/other)
  "language_code": str | None,
  "is_generated": bool | None,     # True for auto-generated subs (best-effort)
  "snippets": [
      {"text": str, "start": float, "duration": float},
      ...
  ],
  "source": "yt-dlp"
}

Notes & Assumptions:
- We attempt languages in priority order provided by the caller, then fall back to
  a default list ["es","en"] if none specified.
- We only perform an *auto-sub* download ("--write-auto-subs"). If manual subs
  exist they are included as well when present (yt-dlp writes whichever it can).
- To reduce chances of IP blocking, a small delay (configurable) can be applied
  between invocations by external orchestrator; here we optionally sleep if
  TRANSCRIPT_YTDLP_SLEEP env var is set (>0).
- We do NOT cache results on disk beyond temporary JSON artifacts produced by yt-dlp.
  Consider adding application-level caching if you call this frequently.
- Error handling: raises TranscriptError (reused pattern) for consistency.

Security / ToS Disclaimer: Ensure usage complies with YouTube Terms of Service and
only process videos you have rights to process.
"""
from __future__ import annotations
import os
import re
import json
import shutil
import tempfile
import subprocess
import time
from typing import Iterable, Dict, Any, Optional, List

# Reuse TranscriptError definition pattern (do not import youtube-transcript-api here)
class TranscriptError(Exception): ...

_SP = {"el","la","de","que","y","en","a","los","se","del","las","un","por","con","una","su","para","es","al","lo","como","más","pero","sus","le"}
_EN = {"the","and","to","of","in","that","it","is","for","on","as","are","was","with","this","by","an","be","or","from"}

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,}$")

# -------------------- Helpers --------------------

def _is_valid_id(v: str) -> bool:
    return "://" not in v and bool(_YT_ID_RE.match(v))

def extract_video_id(url_or_id: str) -> str:
    url_or_id = url_or_id.strip()
    if _is_valid_id(url_or_id):
        return url_or_id
    from urllib.parse import urlparse, parse_qs
    try:
        p = urlparse(url_or_id)
    except Exception as e:
        raise TranscriptError(f"URL inválida: {e}") from e
    if p.netloc in ("youtu.be", "www.youtu.be"):
        vid = p.path.lstrip("/")
        if _is_valid_id(vid):
            return vid
    if p.netloc.endswith("youtube.com"):
        qs = parse_qs(p.query)
        vid = qs.get("v", [None])[0]
        if vid and _is_valid_id(vid):
            return vid
        parts = [x for x in p.path.split("/") if x]
        if "embed" in parts:
            try:
                vid = parts[parts.index("embed") + 1]
                if _is_valid_id(vid):
                    return vid
            except Exception:
                pass
    raise TranscriptError("No se pudo extraer video_id")

def _guess_lang(text: str) -> str:
    words = re.findall(r"[a-záéíóúüñ]+", text.lower())
    if not words:
        return "other"
    es = sum(1 for w in words if w in _SP)
    en = sum(1 for w in words if w in _EN)
    if es >= 3 and es > en * 1.2:
        return "es"
    if en >= 3 and en > es * 1.2:
        return "en"
    return "other"

# -------------------- Core Extraction --------------------

def _build_command(video_id: str, langs: List[str]) -> List[str]:
    # json3 chosen for structured timing data
    return [
        "yt-dlp",
        f"https://www.youtube.com/watch?v={video_id}",
        "--skip-download",
        "--write-auto-subs",
        "--write-subs",
    "--ignore-errors",           # proceed even if some resources fail
    "--no-warnings",             # reduce noise in stderr (warnings caused non-zero exits in some cases)
        "--sub-format", "json3",
        "--sub-langs", ",".join(langs),
        "-o", os.path.join(tempfile.gettempdir(), "%(id)s")
    ]

def _load_first_available(video_id: str, langs: List[str]) -> tuple[str, list[dict]]:
    tmp = tempfile.gettempdir()
    # Try in order; return first language file found with content
    for lang in langs:
        cand = os.path.join(tmp, f"{video_id}.{lang}.json3")
        if os.path.exists(cand):
            with open(cand, "r", encoding="utf-8") as f:
                data = json.load(f)
            events = data.get("events", [])
            out: list[dict] = []
            for ev in events:
                if "segs" in ev and "tStartMs" in ev:
                    text = "".join(seg.get("utf8", "") for seg in ev.get("segs", []))
                    if text and not text.startswith("["):
                        start = ev["tStartMs"] / 1000.0
                        dur = ev.get("dDurationMs", 0) / 1000.0
                        out.append({"text": text.strip(), "start": start, "duration": dur})
            if out:
                return lang, out
    raise TranscriptError("No se pudo leer subtítulos en los idiomas solicitados")

def fetch_transcript_yt_dlp(
    url_or_id: str,
    languages: Optional[Iterable[str]] = None,
    preferred_order: Optional[Iterable[str]] = None,
    extra_retries: int = 2,
    backoff: float = 2.0,
) -> Dict[str, Any]:
    """Fetch transcript using yt-dlp only.

    languages: list of requested language codes (roots). Used to build the subtitle
               download list; if None we default to ["es","en"].
    preferred_order: explicit priority when picking which caption file to parse first.
    extra_retries: retries for transient yt-dlp errors.
    backoff: base backoff between yt-dlp retries.
    """
    video_id = extract_video_id(url_or_id)

    # Compose language preference list
    req = [l.strip().lower() for l in (languages or []) if l and l.strip()]
    if not req:
        req = ["es", "en"]
    # Extend with fallback defaults to ensure at least attempt
    extended = list(dict.fromkeys(req + ["es", "en"]))  # de-duplicate preserving order

    # External throttle (optional) to reduce risk of block
    global_sleep = float(os.getenv("TRANSCRIPT_YTDLP_SLEEP", "0") or 0)
    if global_sleep > 0:
        time.sleep(global_sleep)

    if not shutil.which("yt-dlp"):
        raise TranscriptError("yt-dlp no está instalado en el contenedor")

    cmd = _build_command(video_id, extended)

    last_err: Exception | None = None
    for attempt in range(1, extra_retries + 2):  # first try + retries
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            stderr_snip = (proc.stderr or "").strip()[:400]
            # Some environments report exit code 1 with only warnings; attempt to parse anyway if files exist.
            if proc.returncode != 0:
                try:
                    picked_lang, snippets = _load_first_available(
                        video_id, preferred_order and list(preferred_order) or extended
                    )
                except Exception:
                    raise TranscriptError(
                        f"yt-dlp error code {proc.returncode}: {stderr_snip or 'error desconocido'}"
                    )
                else:
                    full_text = " ".join(s["text"] for s in snippets)
                    lang_guess = _guess_lang(full_text)
                    return {
                        "video_id": video_id,
                        "language": lang_guess,
                        "language_code": picked_lang,
                        "is_generated": True,
                        "snippets": snippets,
                        "source": "yt-dlp",
                        "warning": stderr_snip,
                    }
            picked_lang, snippets = _load_first_available(video_id, preferred_order and list(preferred_order) or extended)
            full_text = " ".join(s["text"] for s in snippets)
            lang_guess = _guess_lang(full_text)
            # auto-generated guess: if file name language not identical to guess mark generated True (heuristic)
            is_generated = True  # we cannot easily differentiate; set True
            return {
                "video_id": video_id,
                "language": lang_guess,
                "language_code": picked_lang,
                "is_generated": is_generated,
                "snippets": snippets,
                "source": "yt-dlp",
            }
        except Exception as e:
            last_err = e
            if attempt <= extra_retries:
                time.sleep(backoff * attempt)
                continue
            raise TranscriptError(f"Falló extracción con yt-dlp: {e}") from e

    raise TranscriptError(f"Falló extracción con yt-dlp tras reintentos: {last_err}")

# Convenience safe wrapper

def safe_fetch_transcript_yt_dlp(url_or_id: str, languages: Optional[Iterable[str]] = None):
    try:
        return {"ok": True, "data": fetch_transcript_yt_dlp(url_or_id, languages=languages), "error": None}
    except TranscriptError as e:
        return {"ok": False, "data": None, "error": str(e)}
