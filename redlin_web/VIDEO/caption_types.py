"""Shared caption/transcript types and exceptions."""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

class TranscriptError(Exception):
    """Base error for transcript extraction issues."""
    pass

class NoSubtitlesAvailable(TranscriptError):
    """Raised when no subtitles (manual or auto) are available after exhaustive attempts."""
    pass

@dataclass
class TranscriptSnippet:
    text: str
    start: float
    duration: float

@dataclass
class TranscriptResult:
    video_id: str
    title: Optional[str]
    language: Optional[str]
    language_code: Optional[str]
    is_generated: bool
    snippets: List[Dict[str, Any]]  # using original dict shape for backward compatibility
    source: str
    warning: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "title": self.title,
            "language": self.language,
            "language_code": self.language_code,
            "is_generated": self.is_generated,
            "snippets": self.snippets,
            "source": self.source,
            **({"warning": self.warning} if self.warning else {}),
        }
