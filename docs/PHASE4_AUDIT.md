# Phase 4 Audit (Maintainability and Safe Cleanup)

Date: 2026-04-21

## Scope

This audit focused on low-risk cleanup steps that preserve runtime behavior while reducing maintenance risk in API/CORE/VIDEO modules.

## Safe Changes Applied

1. Replaced legacy side-effectful API task module implementation.

- File: `redlin_web/API/tasks.py`
- Why: Celery autodiscovers `tasks.py` in installed apps, and the previous module executed heavy import-time side effects (`nltk.download(...)`) with placeholder logic.
- Change: Converted to a side-effect-free Celery wrapper around the new service-layer processing pipeline.
- Compatibility: Kept a synchronous `process_pdf(document_id)` function for backward compatibility.

2. Standardized serializer module naming for new imports.

- File added: `redlin_web/API/serializers.py`
- Why: Django/DRF convention is plural `serializers.py`; project still had `serializer.py` singular.
- Change: Added compatibility alias module that re-exports from `serializer.py`.
- Compatibility: Existing imports from `serializer.py` still work.

3. Moved API internals to non-legacy import targets.

- Updated files:
  - `redlin_web/API/views_auth.py`
  - `redlin_web/API/views_documents.py`
  - `redlin_web/API/views_learning.py`
  - `redlin_web/API/feynman_ai.py`
- Why: Reduce reliance on transitional facades (`task_2.py`) and singular serializer naming for internal code.
- Change:
  - Internal imports now use `serializers.py` alias.
  - `views_documents.py` now calls `services.document_processing_service.process_pdf` directly.
  - `feynman_ai.py` now imports `detect_language`, `generate_with_retry`, and JSON extractor directly from `services.processing_common`.

## Verification

Executed in Docker:

- `docker compose exec -T backend pytest API/tests/test_auth_errors.py API/tests/test_cloze_api.py -q`
- Result: `8 passed`

## Candidates Not Auto-Deleted (Require Explicit Approval)

1. `redlin_web/API/task_2.py`

- Current role: Explicit compatibility facade for legacy imports.
- Evidence: Still imported by `redlin_web/API/feynman_ai.py` in old commits and may be referenced externally.
- Risk if removed now: Breaking out-of-tree imports or stale runtime paths.

2. `redlin_web/API/views.py`

- Current role: Compatibility re-export facade.
- Evidence: Not required by current `urls.py`, but useful for backward compatibility with old imports.
- Risk if removed now: External/internal import breakage.

3. `redlin_web/VIDEO/transcript.py`

- Evidence from in-repo references: no active imports found; `VIDEO/ai.py` uses `transcript_yt_dlp.py` instead.
- Risk if removed now: Potential ad-hoc/manual usage not captured by static import analysis.

## Recommended Next Step (Phase 4.1)

If approved, perform a controlled deprecation pass:

1. Add clear deprecation headers to `API/task_2.py`, `API/views.py`, and `VIDEO/transcript.py`.
2. Add one test/assertion (or CI grep check) ensuring no internal imports rely on deprecated modules.
3. Remove deprecated files in a later release after one compatibility window.

## Phase 4.1 Execution (2026-04-20)

Completed:

1. Added explicit deprecation headers to:
- `redlin_web/API/task_2.py`
- `redlin_web/API/views.py`
- `redlin_web/VIDEO/transcript.py`

2. Added a regression guard test to block internal imports of deprecated
compatibility modules:
- `redlin_web/API/tests/test_deprecated_import_guards.py`

Notes:

- The compatibility modules remain in place for external consumers during the
deprecation window.
- Internal code should keep importing from split modules and service-layer
implementations.
