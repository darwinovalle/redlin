# Class Transcription Implementation Plan (Free-First, Docker-First)

This plan is optimized for your current stage:
- Zero recurring STT cost for MVP
- Clear separation of concerns with a new Django app
- Reuse of existing generation services (summary, MCQs, clozes)
- Checkbox workflow so you can track progress and resume anytime

## Architecture Decision (Confirm First)

- [x] Create a new Django app dedicated to class recording/transcription lifecycle (recommended name: CLASSROOM).
- [x] Keep API app as the generation domain owner for summary, MCQs, clozes.
- [x] Expose one shared text-processing entrypoint used by both PDF flow and transcription flow.
- [x] Do not generate a PDF for internal processing.
- [ ] Optional only: add transcript-to-PDF export later as a user feature.

## Fallback Strategy (STT and Processing)

Use this order in production code so your system degrades gracefully.

- [x] Fallback 1 (primary MVP): local faster-whisper transcription.
- [x] Fallback 2: lower-size faster-whisper model when compute is constrained.
- [ ] Fallback 3: queue for retry with backoff if transcription fails.
- [ ] Fallback 4 (optional): cloud STT provider behind feature flag only.
- [x] Fallback 5: if STT still fails, keep session data and allow manual transcript paste to continue pipeline.

Recommended model policy:
- Default: small model
- Low-resource fallback: base model
- Accuracy-focused fallback: medium model (if hardware allows)

## Why Local faster-whisper for Your MVP

- [x] Zero API cost.
- [x] Good quality for long-form lectures.
- [x] Works offline.
- [x] Easy to run in your existing backend/worker containers.

Tradeoff:
- [x] Accept slower speed on CPU-only machines during MVP.

## Phase 1: Foundation and App Separation

- [x] Create new app folder for class sessions.
- [x] Register app in Django settings.
- [x] Add app urls and include them in project routing.
- [x] Add model: ClassSession.
- [x] Add model: TranscriptSegment (optional but strongly recommended for timeline and retries).
- [x] Add migration files and apply migrations in Docker.

ClassSession suggested fields:
- id, user, title
- status: recording, transcribing, ready, processing, completed, failed
- language, started_at, ended_at
- transcript_text (final normalized text)
- source_meta (json)
- created_at, updated_at

TranscriptSegment suggested fields:
- class_session
- start_sec, end_sec
- speaker_label (optional)
- text
- confidence (optional)
- sequence
- created_at

## Phase 2: Local STT Service Layer

- [x] Add service module in new app: stt_service.py.
- [x] Add provider interface method: transcribe_audio_file(audio_path, language_hint=None).
- [x] Implement faster-whisper provider.
- [x] Add env vars for model and compute tuning.
- [x] Add robust exception mapping (timeout, decode error, model unavailable).

Suggested environment variables:
- STT_PROVIDER=local_faster_whisper
- STT_MODEL_SIZE=small
- STT_DEVICE=cpu
- STT_COMPUTE_TYPE=int8
- STT_LANGUAGE=es
- STT_ENABLE_VAD=true

## Phase 3: Frontend-Backend Contract (MVP Batch Upload)

Start with batch mode first. Add streaming later.

- [x] Endpoint: POST /classroom/sessions/start
- [x] Endpoint: POST /classroom/sessions/{id}/upload-audio
- [x] Endpoint: POST /classroom/sessions/{id}/finish
- [x] Endpoint: GET /classroom/sessions/{id}/status
- [x] Endpoint: GET /classroom/sessions/{id}/results

Expected MVP UX:
- [x] User starts recording in browser.
- [x] Frontend stores one audio blob locally.
- [x] On stop, frontend uploads one file.
- [x] Backend transcribes async via Celery.
- [x] Backend runs learning generation async.
- [x] Frontend polls status and then reads results.

## Phase 4: Shared Generation Pipeline (Code Reuse)

- [x] Refactor current document pipeline to expose process_document_text(document_id, text).
- [x] Keep existing PDF path: extract text then call shared function.
- [x] New classroom path: transcript text then call shared function.
- [x] Reuse existing summary, MCQ, cloze service calls.
- [ ] Ensure idempotency for retries (safe rerun behavior).

## Phase 5: Celery Workflow

- [x] Add new task: transcribe_class_session_task(session_id).
- [x] Add new task: process_class_session_task(session_id).
- [x] Chain tasks or orchestrate sequentially with clear status transitions.
- [x] Update status transitions with error-safe rollback.

Suggested state transitions:
- recording -> transcribing -> ready -> processing -> completed
- any stage -> failed (with error details)

## Phase 6: Data Quality and Safety

- [x] Add transcript normalization step (dedupe filler, merge tiny fragments).
- [x] Add minimum transcript threshold before generation (word count).
- [ ] Add max transcript length policy and chunking policy.
- [x] Persist error details for support/debug.

## Phase 7: Tests (Docker)

- [ ] Unit test stt_service provider selection and fallbacks.
- [ ] Unit test status transitions and retry-safe logic.
- [x] Integration test full flow: start -> upload -> finish -> completed.
- [ ] Integration test fallback to manual transcript paste.
- [ ] Regression test existing PDF pipeline remains unchanged.

Run tests in Docker:
- docker compose exec -T backend pytest -q

## Phase 8: Optional Upgrades After MVP

- [ ] Real-time chunk streaming transcription.
- [ ] Speaker diarization.
- [ ] WebSocket push for live transcript updates.
- [ ] Cloud STT as optional provider under feature flag.
- [ ] Transcript export to PDF (user feature only).

## Practical Local faster-whisper Setup Notes

- [x] Add dependencies to backend image requirements.
- [x] Ensure ffmpeg is available in backend and worker containers.
- [ ] Keep model cache in mounted volume if startup time becomes high.
- [x] Start with int8 compute on CPU to reduce resource usage.

Suggested dependency additions:
- faster-whisper

System package needed in container:
- ffmpeg

## Cost Policy

- [ ] Keep STT local by default in all non-production environments.
- [ ] Disable cloud provider by default.
- [ ] Add explicit environment gate for any paid provider.

## Ready-to-Start Checklist

- [ ] Approve app name (CLASSROOM or another name).
- [ ] Approve MVP mode (batch upload first).
- [ ] Approve no internal PDF conversion.
- [ ] Approve fallback order above.
- [ ] Begin implementation Phase 1.
