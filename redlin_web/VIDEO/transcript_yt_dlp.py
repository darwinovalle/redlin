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
import glob
import shutil
import tempfile
import subprocess
import time
import threading
from typing import Iterable, Dict, Any, Optional, List
import requests

# Reuse TranscriptError definition pattern (do not import youtube-transcript-api here)
class TranscriptError(Exception): ...
class NoSubtitlesAvailable(TranscriptError): ...

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

_FETCH_LOCK = threading.Lock()
_LAST_FETCH_TS = 0.0
_MIN_INTERVAL = float(os.getenv("TRANSCRIPT_MIN_INTERVAL", os.getenv("TRANSCRIPT_YTDLP_INTERVAL", "0.8")))  # seconds

def _maybe_throttle():
    """Simple global throttle to avoid rapid-fire requests that raise suspicion.
    Ensures at least _MIN_INTERVAL between launches of yt-dlp. Thread-safe.
    """
    global _LAST_FETCH_TS
    if _MIN_INTERVAL <= 0:
        return
    with _FETCH_LOCK:
        now = time.time()
        delta = now - _LAST_FETCH_TS
        if delta < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - delta)
        _LAST_FETCH_TS = time.time()

def _build_command(video_id: str, langs: List[str], client_variant: Optional[str] = None) -> List[str]:
    # json3 chosen for structured timing data
    cmd = [
        "yt-dlp",
        f"https://www.youtube.com/watch?v={video_id}",
        "--skip-download",
    "--write-auto-sub",   # correct flag (singular) to download auto-generated subs
    "--write-sub",        # correct flag (singular) to download manual subs if present
        "--ignore-errors",  # proceed even if some resources fail
        "--no-warnings",  # reduce noise in stderr (warnings caused non-zero exits in some cases)
        "--print", "title",  # print title to stdout
        "--sub-format", "json3/vtt",  # allow fallback to vtt if json3 not available
        "--sub-langs", ",".join(langs),
        "-o", os.path.join(tempfile.gettempdir(), "%(id)s"),
    ]
    if not os.getenv("TRANSCRIPT_VERBOSE"):
        cmd.insert(1, "-q")
    # Rotate youtube player client variants to mitigate 403 / DNS / region anomalies.
    # Supported examples (yt-dlp docs): web, android, ios, tv, web_embedded
    if client_variant:
        client_variant = client_variant.strip()
        if client_variant:
            cmd += ["--extractor-args", f"youtube:player_client={client_variant}"]
    return cmd

def _parse_json3(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
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
    return out

_VTT_TS_RE = re.compile(r"^(\d{2,}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2,}):(\d{2}):(\d{2})\.(\d{3})")

def _hms_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

def _parse_vtt(path: str) -> list[dict]:
    out: list[dict] = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = [l.rstrip('\n') for l in f]
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        m = _VTT_TS_RE.match(line)
        if m:
            start = _hms_to_seconds(*m.groups()[0:4])
            end = _hms_to_seconds(*m.groups()[4:8])
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip():
                text_lines.append(lines[i].strip())
                i += 1
            text = " ".join(text_lines).strip()
            if text:
                out.append({"text": text, "start": start, "duration": max(0.0, end - start)})
        i += 1
    return out

def _scan_caption_files(video_id: str) -> dict:
    tmp = tempfile.gettempdir()
    pattern = os.path.join(tmp, f"{video_id}.*")
    files = glob.glob(pattern)
    # Also scan current working directory as fallback (if -o failed)
    cwd_pattern = os.path.join(os.getcwd(), f"*{video_id}*.*")
    files += glob.glob(cwd_pattern)
    caps = {}
    for fpath in files:
        base = os.path.basename(fpath)
        parts = base.split('.')
        if len(parts) < 3:
            continue
        # Expect format <video_id>.<lang>.<ext>
        if parts[0] != video_id:
            # Try to locate video_id segment inside filename (e.g., Title [videoid].en.json3)
            if video_id not in base:
                continue
            # Heuristic: language code should be second to last component before extension
            # e.g., Title_[id].en.json3 -> components [..., id], 'en', 'json3'
            if len(parts) >= 3:
                lang = parts[-2].lower()
            else:
                continue
        else:
            lang = parts[1].lower()
        ext = parts[-1].lower()
        if ext in ("json3", "vtt"):
            caps.setdefault(lang, []).append(fpath)
    return caps

def _choose_best_file(lang_files: list[str]) -> str:
    # Prefer json3 over vtt
    for f in lang_files:
        if f.endswith('.json3'):
            return f
    return lang_files[0]

def _load_first_available(video_id: str, langs: List[str]) -> tuple[str, list[dict]]:
    caps = _scan_caption_files(video_id)
    if os.getenv('TRANSCRIPT_DEBUG'):
        print(f"[yt-dlp DEBUG] caption files encontrados: {list(caps.keys())}")
    # Normalize: for each requested lang, allow exact or prefix match (lang-XX)
    for req in langs:
        req_low = req.lower()
        candidates = [code for code in caps.keys() if code == req_low or code.startswith(req_low + '-')]
        for code in candidates:
            path = _choose_best_file(caps[code])
            if path.endswith('.json3'):
                snippets = _parse_json3(path)
            else:
                snippets = _parse_vtt(path)
            if snippets:
                # Return the canonical requested base code (req) rather than full variant
                return req_low, snippets
    # If nothing matched requested, try any available as last resort
    if caps:
        # pick deterministic first (sorted) code
        code = sorted(caps.keys())[0]
        path = _choose_best_file(caps[code])
        snippets = _parse_json3(path) if path.endswith('.json3') else _parse_vtt(path)
        if snippets:
            return code, snippets
    raise TranscriptError("No se pudo leer subtítulos en los idiomas solicitados (tras wildcard y VTT fallback)")

def _discover_available_langs(video_id: str) -> List[str]:
    """Descubre idiomas disponibles usando salida JSON (-J) para evitar parsing frágil.
    Combina claves de 'subtitles' y 'automatic_captions'."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        proc = subprocess.run(["yt-dlp", "-J", "--skip-download", url], capture_output=True, text=True, timeout=120)
    except Exception as e:
        if os.getenv('TRANSCRIPT_DEBUG'):
            print(f"[yt-dlp DEBUG] _discover_available_langs exception: {e}")
        return []
    if proc.returncode != 0:
        if os.getenv('TRANSCRIPT_DEBUG'):
            print(f"[yt-dlp DEBUG] _discover_available_langs returncode={proc.returncode} stderr={proc.stderr[:160] if proc.stderr else ''}")
        return []
    try:
        info = json.loads(proc.stdout)
    except Exception as e:
        if os.getenv('TRANSCRIPT_DEBUG'):
            print(f"[yt-dlp DEBUG] _discover_available_langs JSON parse error: {e}")
        return []
    langs: List[str] = []
    for key in ("subtitles", "automatic_captions"):
        data = info.get(key) or {}
        for lang_code, entries in data.items():
            # entries is list of dicts with 'ext'
            if entries and any(ent.get('ext') in ('json3','vtt','srv1','srv2','srv3','ttml') for ent in entries):
                if lang_code not in langs:
                    langs.append(lang_code)
    if os.getenv('TRANSCRIPT_DEBUG'):
        print(f"[yt-dlp DEBUG] discovered langs via JSON: {langs}")
    return langs

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

    # Client variant rotation list
    client_variants_env = os.getenv("TRANSCRIPT_CLIENT_VARIANTS", "web,android,ios")
    client_variants = [c.strip() for c in client_variants_env.split(',') if c.strip()]
    if not client_variants:
        client_variants = [None]
    variant_index = 0
    current_variant = client_variants[variant_index] if variant_index < len(client_variants) else None

    cmd = _build_command(video_id, extended, current_variant)

    last_err: Exception | None = None
    attempted_fallback = False
    attempted_all = False
    attempted_en_variant = False
    # Patterns indicating transient network / throttling issues
    transient_markers = [
        "http error 403",
        "http error 429",
        "temporary failure in name resolution",
        "failed to resolve",
        "timed out",
        "connection reset",
        "remote end closed connection",
    ]

    for attempt in range(1, extra_retries + 2):  # first try + retries
        try:
            if os.getenv('TRANSCRIPT_DEBUG'):
                print(f"[yt-dlp DEBUG] executing (variant={current_variant} attempt={attempt}): {' '.join(cmd)}")
            _maybe_throttle()
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            if os.getenv('TRANSCRIPT_DEBUG'):
                print(f"[yt-dlp DEBUG] attempt={attempt} returncode={proc.returncode}")
                if proc.stderr:
                    print(f"[yt-dlp DEBUG] stderr: {proc.stderr[:300]}")
            # List any candidate files immediately after run
            if os.getenv('TRANSCRIPT_DEBUG'):
                tmp_matches = glob.glob(os.path.join(tempfile.gettempdir(), f"{video_id}.*"))
                print(f"[yt-dlp DEBUG] tmp matches: {[os.path.basename(x) for x in tmp_matches][:12]}")
                if not tmp_matches and proc.returncode == 0:
                    # Edge case: exit 0 pero no escribe archivos -> forzar enumeración JSON para confirmar subtítulos
                    enum_langs = _discover_available_langs(video_id)
                    if enum_langs:
                        print(f"[yt-dlp DEBUG] exit0 sin archivos -> enum langs JSON: {enum_langs[:12]}")
                        # Intentar descargar uno prioritario (primero que coincida con extended)
                        prioritized = None
                        for want in extended:
                            # buscar match exacto o prefix
                            for avail in enum_langs:
                                if avail == want or avail.startswith(want + '-'):
                                    prioritized = avail
                                    break
                            if prioritized:
                                break
                        if not prioritized:
                            prioritized = enum_langs[0]
                        single_cmd = _build_command(video_id, [prioritized], current_variant)
                        print(f"[yt-dlp DEBUG] intentando single-lang fetch: {prioritized}")
                        _maybe_throttle()
                        proc_single = subprocess.run(single_cmd, capture_output=True, text=True, timeout=140)
                        if os.getenv('TRANSCRIPT_DEBUG'):
                            print(f"[yt-dlp DEBUG] single-lang rc={proc_single.returncode} stderr={(proc_single.stderr or '')[:160]}")
                        tmp_matches2 = glob.glob(os.path.join(tempfile.gettempdir(), f"{video_id}.*"))
                        print(f"[yt-dlp DEBUG] tmp matches tras single: {[os.path.basename(x) for x in tmp_matches2][:6]}")
                # If still no files after enumeration + single attempt, try rotating client variant early
                if not tmp_matches and proc.returncode == 0:
                    stderr_low0 = (proc.stderr or '').lower()
                    if variant_index + 1 < len(client_variants):
                        variant_index += 1
                        current_variant = client_variants[variant_index]
                        if os.getenv('TRANSCRIPT_DEBUG'):
                            print(f"[yt-dlp DEBUG] rotating variant early (no files) -> {current_variant}")
                        cmd = _build_command(video_id, extended, current_variant)
                        time.sleep(0.5)
                        continue
            # Extract title (first non-empty line from stdout)
            title = None
            if proc.stdout:
                for line in proc.stdout.splitlines():
                    line = line.strip()
                    if line:
                        title = line
                        break
            stderr_snip = (proc.stderr or "").strip()[:400]
            # Some environments report exit code 1 with only warnings; attempt to parse anyway if files exist.
            if proc.returncode != 0:
                try:
                    picked_lang, snippets = _load_first_available(
                        video_id, preferred_order and list(preferred_order) or extended
                    )
                except Exception:
                    # Transient rotation if possible
                    stderr_low = (proc.stderr or '').lower()
                    if any(m in stderr_low for m in transient_markers) and variant_index + 1 < len(client_variants):
                        variant_index += 1
                        current_variant = client_variants[variant_index]
                        if os.getenv('TRANSCRIPT_DEBUG'):
                            print(f"[yt-dlp DEBUG] rotating client variant to {current_variant} after transient error")
                        cmd = _build_command(video_id, extended, current_variant)
                        time.sleep(min(5, backoff * attempt))
                        continue
                    raise TranscriptError(
                        f"yt-dlp error code {proc.returncode}: {stderr_snip or 'error desconocido'}"
                    )
                else:
                    full_text = " ".join(s["text"] for s in snippets)
                    lang_guess = _guess_lang(full_text)
                    return {
                        "video_id": video_id,
                        "title": title,
                        "language": lang_guess,
                        "language_code": picked_lang,
                        "is_generated": True,
                        "snippets": snippets,
                        "source": "yt-dlp",
                        "warning": stderr_snip,
                    }
            try:
                picked_lang, snippets = _load_first_available(video_id, preferred_order and list(preferred_order) or extended)
            except TranscriptError as inner_e:
                # Fallback: discover full list of languages and retry once with them
                if not attempted_fallback:
                    discovered = _discover_available_langs(video_id)
                    if discovered:
                        attempted_fallback = True
                        # Rebuild command with discovered list (limit to 8 to avoid over-fetch)
                        new_langs = discovered[:8]
                        cmd = _build_command(video_id, new_langs)
                        # Update extended so loader can find the new files
                        extended = list(dict.fromkeys(new_langs + extended))
                        # restart loop without counting as a failed attempt (continue outer loop)
                        continue
                    else:
                        # Try broad all-subtitles fetch once
                        if not attempted_all:
                            attempted_all = True
                            cmd = _build_command(video_id, ["all,-live_chat"])
                            if os.getenv('TRANSCRIPT_DEBUG'):
                                print("[yt-dlp DEBUG] switching to all,-live_chat fallback")
                            continue
                        # If truly no subtitles AND transient markers -> try variant rotation first
                        # Check last stderr for markers (proc may exist)
                        last_stderr_low = (proc.stderr or '').lower()
                        if any(m in last_stderr_low for m in transient_markers) and variant_index + 1 < len(client_variants):
                            variant_index += 1
                            current_variant = client_variants[variant_index]
                            if os.getenv('TRANSCRIPT_DEBUG'):
                                print(f"[yt-dlp DEBUG] no subs + transient markers -> rotating client to {current_variant}")
                            cmd = _build_command(video_id, extended, current_variant)
                            continue
                        raise NoSubtitlesAvailable(
                            f"Video sin subtítulos disponibles (auto o manual). Intentado: {extended}"
                        )
                elif not attempted_all:
                    attempted_all = True
                    cmd = _build_command(video_id, ["all,-live_chat"], current_variant)
                    if os.getenv('TRANSCRIPT_DEBUG'):
                        print("[yt-dlp DEBUG] second-tier all,-live_chat fallback")
                    continue
                # Specific English variant fallback if still no files and en requested
                if not attempted_en_variant and any(l.startswith('en') for l in extended):
                    attempted_en_variant = True
                    cmd = _build_command(video_id, ["en,en-en"], current_variant)
                    if os.getenv('TRANSCRIPT_DEBUG'):
                        print("[yt-dlp DEBUG] attempting explicit en,en-en fallback")
                    continue
                # If we get here still failing: maybe transient; attempt variant rotation before giving up
                last_stderr_low = (proc.stderr or '').lower()
                if any(m in last_stderr_low for m in transient_markers) and variant_index + 1 < len(client_variants):
                    variant_index += 1
                    current_variant = client_variants[variant_index]
                    if os.getenv('TRANSCRIPT_DEBUG'):
                        print(f"[yt-dlp DEBUG] rotating client variant (late) to {current_variant}")
                    cmd = _build_command(video_id, extended, current_variant)
                    continue
                raise inner_e
            full_text = " ".join(s["text"] for s in snippets)
            lang_guess = _guess_lang(full_text)
            # auto-generated guess: if file name language not identical to guess mark generated True (heuristic)
            is_generated = True  # we cannot easily differentiate; set True
            return {
                "video_id": video_id,
                "title": title,
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
            # Before final failure, attempt direct JSON caption fetch fallback
            break

    # Direct fallback: query info JSON and pull caption URLs manually
    if os.getenv('TRANSCRIPT_DEBUG'):
        print('[yt-dlp DEBUG] initiating direct caption fallback')
    try:
        info_proc = subprocess.run([
            'yt-dlp','-J','--skip-download', f'https://www.youtube.com/watch?v={video_id}'
        ], capture_output=True, text=True, timeout=160)
        if info_proc.returncode != 0:
            raise TranscriptError(f'Fallback info fail rc={info_proc.returncode}: {(info_proc.stderr or "")[:160]}')
        info = json.loads(info_proc.stdout)
    except Exception as e2:
        raise TranscriptError(f"Falló extracción con yt-dlp: {last_err} (fallback info error: {e2})") from e2

    def _pick_caption_source(info: dict, lang_roots: List[str]):
        sources = []
        for key in ('subtitles','automatic_captions'):
            captions = info.get(key) or {}
            for code, entries in captions.items():
                sources.append((code, entries))
        # priority by requested order then others
        for root in lang_roots:
            for code, entries in sources:
                if code == root or code.startswith(root + '-'):
                    yield code, entries
        # then any
        for code, entries in sources:
            yield code, entries

    def _choose_entry(entries):
        # prefer json3 then vtt then others
        order = {'json3':0,'vtt':1,'srv3':2,'srv2':3,'srv1':4}
        entries2 = [e for e in entries if e.get('url')]
        entries2.sort(key=lambda e: order.get(e.get('ext'), 50))
        return entries2[0] if entries2 else None

    picked_code = None
    picked_snippets = None
    for code, entries in _pick_caption_source(info, extended):
        ent = _choose_entry(entries)
        if not ent:
            continue
        url = ent.get('url')
        ext = ent.get('ext')
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=60)
            if resp.status_code != 200 or not resp.text.strip():
                continue
            text = resp.text
            tmp_path = None
            # Parse based on extension
            if ext == 'json3':
                try:
                    data = json.loads(text)
                    events = data.get('events', [])
                    snips = []
                    for ev in events:
                        if 'segs' in ev and 'tStartMs' in ev:
                            seg_text = ''.join(seg.get('utf8','') for seg in ev.get('segs',[]))
                            if seg_text and not seg_text.startswith('['):
                                start = ev['tStartMs']/1000.0
                                dur = ev.get('dDurationMs',0)/1000.0
                                snips.append({ 'text': seg_text.strip(), 'start': start, 'duration': dur })
                    if snips:
                        picked_code = code
                        picked_snippets = snips
                        break
                except Exception:
                    continue
            elif ext == 'vtt':
                # Save temp then reuse parser
                fd, tmp_path = tempfile.mkstemp(suffix='.vtt')
                with os.fdopen(fd, 'w', encoding='utf-8') as ftmp:
                    ftmp.write(text)
                snips = _parse_vtt(tmp_path)
                os.unlink(tmp_path)
                if snips:
                    picked_code = code
                    picked_snippets = snips
                    break
            else:
                # ignore other formats for now
                continue
        except Exception:
            continue

    if picked_snippets:
        full_text = ' '.join(s['text'] for s in picked_snippets)
        lang_guess = _guess_lang(full_text)
        return {
            'video_id': video_id,
            'title': info.get('title'),
            'language': lang_guess,
            'language_code': picked_code,
            'is_generated': True,
            'snippets': picked_snippets,
            'source': 'yt-dlp-direct'
        }

    raise TranscriptError(f"Falló extracción con yt-dlp: {last_err} (fallback direct sin resultados)")

    raise TranscriptError(f"Falló extracción con yt-dlp tras reintentos: {last_err}")

# Convenience safe wrapper

def safe_fetch_transcript_yt_dlp(url_or_id: str, languages: Optional[Iterable[str]] = None):
    try:
        return {"ok": True, "data": fetch_transcript_yt_dlp(url_or_id, languages=languages), "error": None}
    except NoSubtitlesAvailable as e:
        return {"ok": False, "data": None, "error": str(e), "code": "no_subtitles"}
    except TranscriptError as e:
        return {"ok": False, "data": None, "error": str(e)}
