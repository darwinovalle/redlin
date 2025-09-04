# Feynman Explanation Prompts & Evaluation

This document describes the automatic generation of Feynman prompts for documents (and upcoming video support) plus the user answer evaluation workflow.

## Overview
When a PDF Document is uploaded and processed, the system now also generates a set of Feynman prompts. Each prompt asks the learner to explain a concept or mechanism in their own words. For each prompt we store:

- prompt: Short explanation request (<= ~140 chars preferred, hard-truncated at 180).
- key_points: Array of objects {id, point, weight} representing atomic essential ideas the answer should cover. Weights default to 1.0 and can go up to 1.5 for more critical points.
- reference: Reserved (currently null) for future citation / span extraction.

Generation uses the existing Gemini model (gemini-2.5-flash). A soft cap can be configured via env var; otherwise the system imposes an internal safety ceiling (80 prompts) while instructing the model to stop when coverage is complete.

## Environment Variables
| Variable | Purpose | Notes |
|----------|---------|-------|
| GOOGLE_API_KEY | Gemini API key | Required (already used by other AI features) |
| AI_FEYNMAN_MAX | Optional soft max for prompts (integer). "0" or missing = unlimited (internal safety cap applies). | Example: 40 |
| AI_FEYNMAN_REGENERATE | If set to truthy (1/true/yes/on), existing prompts for a document are deleted & regenerated. | Default: off |

## Data Model
### Feynman
Existing model (Document → Feynman one-to-many). Fields:
| Field | Type | Description |
|-------|------|-------------|
| document | FK(Document) | Owner document |
| prompt | Text | Explanation request |
| key_points | JSON | Array of {id, point, weight} |
| reference | Text/null | Future: citation snippet |
| created_at | DateTime | Timestamp |

### FeynmanAttempt
Tracks each user answer.
| Field | Type | Description |
|-------|------|-------------|
| document | FK(Document) | Redundant convenience for filtering |
| feynman | FK(Feynman) | Prompt answered |
| user | FK(User) | Owner of attempt |
| answer_text | Text | Raw normalized answer |
| score | Int(1-100) | Overall evaluation (null if evaluation failed) |
| tier | Char | deficiente | aceptable | sobresaliente (auto classified) |
| breakdown | JSON | Detailed metrics (see below) |
| key_points_coverage | Float | Matched key points fraction |
| created_at / updated_at | DateTime | Audit |

Breakdown JSON schema (example):
```
{
  "score": 82,
  "coverage": 0.78,
  "accuracy": 0.85,
  "clarity": 0.90,
  "simplicity": 0.80,
  "misconceptions_penalty": 0.00,
  "hallucination_penalty": 0.00,
  "matched_key_points": [1,2,5],
  "missing_key_points": [3,4],
  "feedback": "Short improvement feedback."
}
```

Tier mapping (classification at save time):
- score < 60 → deficiente
- 60–79 → aceptable
- 80–100 → sobresaliente

## Generation Flow (Documents)
1. User uploads PDF; `DocumentViewSet.perform_create` invokes `process_pdf` synchronously (current design).
2. After summary, flashcards, MCQs, and cloze generation, `generate_ai_feynman` builds a combined source (summary + truncated raw text) and prompts the model.
3. Model returns JSON: `{ "items": [ { "prompt": ..., "key_points": [...] }, ... ] }`.
4. Validation & persistence: duplicates removed, key points normalized, prompt length truncated.
5. Existing prompts skipped unless `AI_FEYNMAN_REGENERATE` is set.

## Answer Evaluation
Endpoint: `POST /api/feynman/attempt/`
Body: `{ "feynman_id": <id>, "answer": "...user explanation..." }`

Steps:
1. Validate ownership (user must own the associated document).
2. Create `FeynmanAttempt` with answer text.
3. Build evaluation prompt including key points + rubric.
4. LLM returns strict JSON with metrics & feedback.
5. Attempt updated with score, tier (auto), coverage ratio.
6. On JSON parse failure or generation error → HTTP 503 (attempt remains with null score).

Scoring formula (in prompt and implemented implicitly by model instructions):
```
final = round(100 * (
  0.40*coverage + 0.25*accuracy + 0.15*clarity + 0.10*simplicity
  - 0.10*misconceptions_penalty - 0.10*hallucination_penalty
))
```
Clamped 1–100 (model instructed to do so; server also bounds).

## API Summary
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/feynman/?document=ID | List prompts for a document |
| GET | /api/feynman/attempts?feynman=ID | List attempts of current user for a prompt |
| POST | /api/feynman/attempt/ | Submit answer & score |
| GET | /api/documents/{id}/full_details/ | Includes `feynman` array |

## Admin
Registered admin models:
- Feynman (shows prompt preview + attempt count)
- FeynmanAttempt (score, tier, coverage, breakdown readonly)

## Error Handling & Resilience
- Rate limiting: underlying `generate_with_retry` includes exponential backoff.
- Parsing: strict JSON; fallback extraction attempts limited to first balanced object with key hint.
- Failure to evaluate returns 503 without crashing the server; user can retry.

## Future Extensions
- Weighted coverage scoring based on point weights (currently indirectly handled by model reasoning).
- Editable prompts / manual injection.
- Batched evaluation (Celery async) to reduce latency spikes.
- Feedback language customization independent of source language.
- Video Feynman generation & evaluation (next step).

## Security & Privacy
- Only the owning user can list or attempt prompts of their documents.
- Raw user answers stored verbatim; consider future PII scrubbing if needed.

## Testing Notes
- Mock Gemini responses for deterministic tests (patch `generate_with_retry`).
- Validate creation path when `AI_FEYNMAN_REGENERATE` toggles.
- Assert tier classification boundaries at 59/60/79/80.

---
For questions or improvements, see ISSUE tracking entry for Feynman feature.