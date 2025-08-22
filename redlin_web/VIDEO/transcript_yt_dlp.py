"""Transcript extraction (direct-only) via yt-dlp JSON metadata.

Simplificado: solo modo directo; se elimina la antigua lógica de archivos.
Flujo:
    1. `yt-dlp -J --skip-download` (rotación opcional de player_client).
    2. Leer `subtitles` + `automatic_captions`.
    3. Elegir mejor pista (idiomas preferidos, json3 > vtt).
    4. Descargar URL y parsear en memoria.

Env vars:
    TRANSCRIPT_MIN_INTERVAL   -> throttle global (segundos)
    TRANSCRIPT_CLIENT_VARIANTS-> lista CSV (web,android,ios,tv,...)
    TRANSCRIPT_DEBUG          -> debug verbose

Retorno:
    {
        video_id, title, language, language_code, is_generated, snippets, source
    }
"""
from __future__ import annotations
import os
import re
import json
import subprocess
import time
import threading
from typing import Iterable, Dict, Any, Optional, List
import requests

from .caption_types import TranscriptError, NoSubtitlesAvailable
from .caption_parsers import parse_json3_events, parse_vtt_text

_SP = {"el","la","de","que","y","en","a","los","se","del","las","un","por","con","una","su","para","es","al","lo","como","más","pero","sus","le"}
_EN = {"the","and","to","of","in","that","it","is","for","on","as","are","was","with","this","by","an","be","or","from"}

_YT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,}$")

_FETCH_LOCK = threading.Lock()
_LAST_FETCH_TS = 0.0
_MIN_INTERVAL = float(os.getenv("TRANSCRIPT_MIN_INTERVAL", os.getenv("TRANSCRIPT_YTDLP_INTERVAL", "0.8")))

def _dbg(msg: str):
    if os.getenv('TRANSCRIPT_DEBUG'):
        print(f"[yt-dlp DEBUG] {msg}")

def _maybe_throttle():
    global _LAST_FETCH_TS
    if _MIN_INTERVAL <= 0:
        return
    with _FETCH_LOCK:
        now = time.time()
        delta = now - _LAST_FETCH_TS
        if delta < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - delta)
        _LAST_FETCH_TS = time.time()

def _is_valid_id(v: str) -> bool:
    return '://' not in v and bool(_YT_ID_RE.match(v))

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
        vid = p.path.lstrip('/')
        if _is_valid_id(vid):
            return vid
    if p.netloc.endswith("youtube.com"):
        qs = parse_qs(p.query)
        vid = qs.get("v", [None])[0]
        if vid and _is_valid_id(vid):
            return vid
        parts = [x for x in p.path.split('/') if x]
        if 'embed' in parts:
            try:
                vid = parts[parts.index('embed')+1]
                if _is_valid_id(vid):
                    return vid
            except Exception:
                pass
    raise TranscriptError("No se pudo extraer video_id")

def _guess_lang(text: str) -> str:
    words = re.findall(r"[a-záéíóúüñ]+", text.lower())
    if not words:
        return 'other'
    es = sum(1 for w in words if w in _SP)
    en = sum(1 for w in words if w in _EN)
    if es >= 3 and es > en * 1.2:
        return 'es'
    if en >= 3 and en > es * 1.2:
        return 'en'
    return 'other'

def fetch_transcript_yt_dlp(
    url_or_id: str,
    languages: Optional[Iterable[str]] = None,
    preferred_order: Optional[Iterable[str]] = None,  # compat (no-op)
    extra_retries: int = 1,
    backoff: float = 1.5,
) -> Dict[str, Any]:
    """Obtiene transcript usando SOLO modo directo.

    languages: lista de raíces preferidas (por defecto ['es','en']).
    """
    video_id = extract_video_id(url_or_id)
    req = [l.strip().lower() for l in (languages or []) if l and l.strip()]
    if not req:
        req = ['es','en']
    extended = list(dict.fromkeys(req + ['es','en']))

    client_variants_env = os.getenv('TRANSCRIPT_CLIENT_VARIANTS', 'web,android,ios,tv')
    variants = [c.strip() for c in client_variants_env.split(',') if c.strip()] or [None]

    format_priority = {'json3':0,'vtt':1,'srv3':2,'srv2':3,'srv1':4}

    last_error: Exception | None = None

    for variant in variants:
        for attempt in range(1, extra_retries+2):
            try:
                _maybe_throttle()
                cmd = ['yt-dlp','-J','--skip-download', f'https://www.youtube.com/watch?v={video_id}']
                if variant:
                    cmd += ['--extractor-args', f'youtube:player_client={variant}']
                _dbg(f"direct variant={variant} attempt={attempt} -> {' '.join(cmd)}")
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=160)
                if proc.returncode != 0:
                    raise TranscriptError(f"yt-dlp rc={proc.returncode} stderr={(proc.stderr or '')[:160]}")
                try:
                    info = json.loads(proc.stdout)
                except Exception as pe:
                    raise TranscriptError(f"JSON parse error: {pe}") from pe
                title = info.get('title')
                sources = []
                for key in ('subtitles','automatic_captions'):
                    data = info.get(key) or {}
                    for code, entries in data.items():
                        valid = [e for e in entries if e.get('url')]
                        if not valid:
                            continue
                        valid.sort(key=lambda e: format_priority.get(e.get('ext'), 50))
                        sources.append((code, valid))
                if not sources:
                    raise NoSubtitlesAvailable('Video sin lista de captions en JSON')
                def iter_candidates():
                    yield from (
                        (code, entries) for pref in extended for code, entries in sources
                        if code == pref or code.startswith(pref + '-')
                    )
                    seen = set([c for pref in extended for c,_ in sources if c == pref or c.startswith(pref+'-')])
                    for code, entries in sources:
                        if code not in seen:
                            yield code, entries
                for code, entries in iter_candidates():
                    for ent in entries:
                        ext = ent.get('ext')
                        if ext not in ('json3','vtt','srv1','srv2','srv3'):
                            continue
                        url = ent.get('url')
                        if not url:
                            continue
                        try:
                            resp = requests.get(url, timeout=60)
                            if resp.status_code != 200 or not resp.text.strip():
                                continue
                            raw = resp.text
                            if ext == 'json3':
                                snippets = parse_json3_events(raw)
                            elif ext == 'vtt':
                                snippets = parse_vtt_text(raw)
                            else:
                                # ignoramos srv* para simplificar
                                continue
                            if not snippets:
                                continue
                            full_text = ' '.join(s['text'] for s in snippets)
                            lang_guess = _guess_lang(full_text)
                            return {
                                'video_id': video_id,
                                'title': title,
                                'language': lang_guess,
                                'language_code': code,
                                'is_generated': True,
                                'snippets': snippets,
                                'source': 'yt-dlp-direct'
                            }
                        except Exception as e_dl:
                            last_error = e_dl
                            continue
                break  # sin transcript con esta variante
            except NoSubtitlesAvailable as ns:
                last_error = ns
                break
            except Exception as e:
                last_error = e
                if attempt <= extra_retries:
                    time.sleep(backoff * attempt)
                    continue
                break
    if isinstance(last_error, NoSubtitlesAvailable):
        raise last_error
    raise TranscriptError(f"No se pudo extraer transcript (modo directo). Último error: {last_error}")

def safe_fetch_transcript_yt_dlp(url_or_id: str, languages: Optional[Iterable[str]] = None):
    try:
        return {"ok": True, "data": fetch_transcript_yt_dlp(url_or_id, languages=languages), "error": None}
    except NoSubtitlesAvailable as e:
        return {"ok": False, "data": None, "error": str(e), "code": "no_subtitles"}
    except TranscriptError as e:
        return {"ok": False, "data": None, "error": str(e)}
    extra_retries: int = 2,
