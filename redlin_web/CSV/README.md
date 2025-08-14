# CSV app

Endpoints (all require Bearer access token):

- POST /api/csv/imports/upload
  - form-data: file: <your.csv>
  - CSV columns: key_term, definition (header optional)
  - Creates user-linked CSVFlashcard items and returns import metadata.

- GET /api/csv/flashcards/study?limit=20
  - Returns a prioritized batch of cards due for review.

- POST /api/csv/flashcards/{id}/review
  - body: { "quality": 0..5 }
  - Updates spaced-repetition metrics (SM-2 inspired) and returns the card.

Data model:
- CSVImport: user, filename, row_count, created_at
- CSVFlashcard: user, source(import), key_term, definition, status, next_review_at, score, easiness, repetitions, interval

Notes:
- Import uses upsert by (user, key_term) to avoid duplicates.
- Status auto-promotes to "mastered" with enough correct reviews.
- Study prioritizes due cards (next_review_at <= now or null), then low-score, low-exposure ones.
