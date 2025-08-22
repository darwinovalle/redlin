"""Parsers for caption file/content formats (json3, vtt)."""
from __future__ import annotations
import json, re
from typing import List, Dict

_JSON3_EVENTS_KEY = "events"
_VTT_TS_RE = re.compile(r"^(\d{2,}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2,}):(\d{2}):(\d{2})\.(\d{3})")

__all__ = ["parse_json3_events", "parse_vtt_text"]

def parse_json3_events(text: str) -> List[Dict]:
    data = json.loads(text)
    events = data.get(_JSON3_EVENTS_KEY, [])
    out: List[Dict] = []
    for ev in events:
        if "segs" in ev and "tStartMs" in ev:
            segs = ev.get("segs", [])
            seg_text = "".join(seg.get("utf8", "") for seg in segs)
            if seg_text and not seg_text.startswith("["):
                start = ev["tStartMs"]/1000.0
                dur = ev.get("dDurationMs", 0)/1000.0
                out.append({"text": seg_text.strip(), "start": start, "duration": dur})
    return out

def _hms_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h)*3600 + int(m)*60 + int(s) + int(ms)/1000.0

def parse_vtt_text(text: str) -> List[Dict]:
    lines = [l.rstrip('\n') for l in text.splitlines()]
    out: List[Dict] = []
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
            seg_text = " ".join(text_lines).strip()
            if seg_text:
                out.append({"text": seg_text, "start": start, "duration": max(0.0, end-start)})
        i += 1
    return out
