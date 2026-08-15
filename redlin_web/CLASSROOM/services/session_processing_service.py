import os
from django.utils import timezone

from API.models import Document
from CLASSROOM.models import ClassSession, TranscriptSegment

from .stt_service import STTServiceError, transcribe_audio_file
# Import the new classroom orchestrator
from .classroom_processing_service import process_classroom_session_text

def _fail_session(session: ClassSession, message: str) -> None:
    session.status = ClassSession.STATUS_FAILED
    session.error_message = message[:2000]
    session.source_meta = {**(session.source_meta or {}), "last_error": message[:500]}
    session.save(update_fields=["status", "error_message", "source_meta", "updated_at"])


def _normalize_transcript_text(raw_text: str) -> str:
    return " ".join((raw_text or "").split()).strip()


def _word_count(text: str) -> int:
    return len([token for token in text.split(" ") if token])


def transcribe_class_session(session_id: int) -> None:
    session = ClassSession.objects.select_related("user").filter(id=session_id).first()
    if not session:
        return

    if not session.audio_file:
        _fail_session(session, "No audio file uploaded for this session.")
        return

    session.status = ClassSession.STATUS_TRANSCRIBING
    session.error_message = ""
    session.save(update_fields=["status", "error_message", "updated_at"])

    try:
        result = transcribe_audio_file(session.audio_file.path, language_hint="en")  # English-only transcription
    except STTServiceError as exc:
        _fail_session(session, str(exc))
        return
    except Exception as exc:
        _fail_session(session, f"Unexpected transcription error: {exc}")
        return

    TranscriptSegment.objects.filter(class_session=session).delete()
    TranscriptSegment.objects.bulk_create(
        [
            TranscriptSegment(
                class_session=session,
                sequence=item.sequence,
                start_sec=item.start_sec,
                end_sec=item.end_sec,
                text=item.text,
                confidence=item.confidence,
            )
            for item in result.segments
        ]
    )

    session.transcript_text = _normalize_transcript_text(result.text)
    session.status = ClassSession.STATUS_READY
    session.source_meta = {
        **(session.source_meta or {}),
        "segments_count": len(result.segments),
        "transcript_chars": len(result.text),
    }
    session.save(update_fields=["transcript_text", "status", "source_meta", "updated_at"])


def process_class_session(session_id: int) -> None:
    session = ClassSession.objects.select_related("user", "linked_document").filter(id=session_id).first()
    if not session:
        return

    transcript_text = _normalize_transcript_text(session.transcript_text)
    if not transcript_text:
        _fail_session(session, "Transcript is empty. Cannot generate study materials.")
        return

    min_words = int(os.getenv("STT_MIN_TRANSCRIPT_WORDS", "40"))
    if _word_count(transcript_text) < min_words:
        _fail_session(
            session,
            f"Transcript is too short to generate quality materials. Minimum words required: {min_words}.",
        )
        return

    session.status = ClassSession.STATUS_PROCESSING
    session.error_message = ""
    session.save(update_fields=["status", "error_message", "updated_at"])

    try:
        # --- FIX: Use the CLASSROOM orchestrator instead of creating/using a Document ---
        process_classroom_session_text(session, transcript_text)

        session.status = ClassSession.STATUS_COMPLETED
        session.ended_at = timezone.now()
        session.save(update_fields=["status", "ended_at", "updated_at"])
    except Exception as exc:
        _fail_session(session, f"Processing failed: {exc}")