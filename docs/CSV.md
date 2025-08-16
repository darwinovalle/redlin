# CSV Import & Study API

This document describes the CSV app endpoints that let users upload a CSV of terms and definitions, generate user-linked flashcards, and study them with a spaced‑repetition algorithm.

All endpoints require Bearer JWT unless stated otherwise. See `docs/JWT.md` for auth usage.

Base URL (local dev): `http://localhost:8000/api/`

---

## Data model

### CSVImport
- id: integer
- user: API.User (owner)
- filename: string
- row_count: integer (number of created/updated cards)
- created_at: datetime

Purpose: audit trail for user uploads and as a source link for generated cards.

### CSVFlashcard
- id: integer
- user: API.User (owner)
- source: CSVImport (upload that created/last updated the card)
- key_term: string (unique per user)
- definition: text
- status: enum [still_learning, mastered] (default: still_learning)
- last_reviewed: datetime (auto)
- next_review_at: datetime | null (due immediately when null)
- times_shown: int (exposure count)
- score: float in [0..1] (normalized mastery)
- repetitions: int (consecutive correct answers)
- interval: int (days until next review)
- easiness: float (SM‑2 EF, baseline 2.5)

Constraints:
- Unique (user, key_term) — prevents duplicates per user.
- Indexed (user, next_review_at) + (user, status) — speeds study queries.

---

## Import: Upload CSV

POST `/csv/imports/upload`

- Auth: Bearer JWT
- Body: `multipart/form-data`
  - `file`: .csv
- CSV shape (two columns):
  1) key_term, 2) definition
- Header row: optional. If the first row looks like a header (e.g., `keyword,definition`), it is ignored.
- Encoding: UTF‑8 (fallback to latin‑1)
- Size limit: 5MB
- Upsert policy: Existing term for the same user updates definition and resets SR metrics (keeps one card per term).

Response 201
```
{
  "import": {
    "id": 12,
    "user": 3,
    "filename": "cards.csv",
    "row_count": 42,
    "created_at": "2025-08-13T20:11:00Z"
  },
  "created": 40
}
```

Example (curl)
```
curl -X POST \
  -H "Authorization: Bearer <ACCESS>" \
  -F "file=@/path/to/cards.csv" \
  http://localhost:8000/api/csv/imports/upload
```

---

## Study: Get a prioritized batch

GET `/csv/flashcards/study?limit=20`

- Auth: Bearer JWT
- Query:
  - `limit` (int, 1..100, default 20)
- Ordering logic:
  1) Due first: `next_review_at <= now` or `next_review_at is null`.
  2) Then by lower `score` and lower `times_shown` to emphasize weak/underexposed items.

Response 200
```
[
  {
    "id": 77,
    "user": 3,
    "source": 12,
    "key_term": "Python",
    "definition": "Programming language",
    "status": "still_learning",
    "last_reviewed": "2025-08-13T20:15:00Z",
    "next_review_at": null,
    "times_shown": 0,
    "score": 0.0,
    "repetitions": 0,
    "interval": 0,
    "easiness": 2.5
  }
]
```

Example
```
curl -H "Authorization: Bearer <ACCESS>" \
  "http://localhost:8000/api/csv/flashcards/study?limit=20"
```

---

## Review: Submit answer quality for a card

POST `/csv/flashcards/{id}/review`

- Auth: Bearer JWT
- Body (JSON): `{ "quality": 0..5 }`
  - 0..2 = incorrect/poor recall → resets repetitions, keeps status `still_learning`, immediate re‑exposure.
  - 3..5 = correct with varying confidence → increases repetitions, updates easiness, schedules next review.

Scheduling (SM‑2 inspired):
- Easiness update: `EF = max(1.3, EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))`
- Intervals: 1d, 6d, then `interval = round(prev_interval * EF)`
- Mastery: auto‑promote to `mastered` when `repetitions >= 5` and `easiness >= 2.5`.
- Score: normalized [0..1] using EF and repetitions to drive prioritization.

Response 200: updated card object (see Study response shape).

Example
```
curl -X POST \
  -H "Authorization: Bearer <ACCESS>" \
  -H "Content-Type: application/json" \
  -d '{"quality":5}' \
  http://localhost:8000/api/csv/flashcards/77/review
```

---

## Listing & filtering (optional)

These are provided by the ViewSets for convenience:

- GET `/csv/imports/` → list user’s imports (auth owner only)
- GET `/csv/imports/{id}/` → import detail (auth owner only)

- GET `/csv/flashcards/?status=still_learning|mastered` → list user’s cards with optional status filter
- GET `/csv/flashcards/{id}/` → card detail (auth owner only)
- PATCH `/csv/flashcards/{id}/` → update card fields (advanced)
- DELETE `/csv/flashcards/{id}/` → delete a card (advanced)

Note: creating cards manually (POST /csv/flashcards/) is possible but not recommended—use the CSV import endpoint for consistency.

---

## Error handling
- 400 Bad Request
  - Invalid file type/size
  - CSV rows missing required columns
  - Invalid `quality` value
- 401 Unauthorized
  - Missing/invalid Bearer token
- 403 Forbidden
  - Accessing resources not owned by the user
- 404 Not Found
  - Card/import does not exist or not owned by user

Response format example
```
{ "error": "Invalid CSV file" }
```

---

## Front‑end integration notes
- Use the login/register endpoints in `API` to obtain tokens; then include `Authorization: Bearer <ACCESS>`.
- After a successful upload, fetch a study batch and render cards in order.
- For each revealed/answered card, POST `quality` immediately to `/review` to keep the schedule accurate.
- Refresh the batch periodically to include newly due items.

---

## Design highlights
- DRY, SOLID: review logic encapsulated in `CSV/utils.py::apply_review` and reused by the view.
- Upsert on import prevents duplicates and resets SR metrics on definition changes.
- Indexed queries for due cards and status filtering.
- Minimal, predictable API surface for the FE; Swagger docs can be expanded next.

---

## Future enhancements (optional)
- OpenAPI annotations for these endpoints in Swagger.
- Batch review endpoint to reduce network round‑trips.
- User settings: daily new cards cap, default study size.
- CSV export and import versioning.
- Merge CSV and API flashcards into a single model with generic source.
