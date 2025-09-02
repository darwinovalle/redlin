# AI Cloze Generation

Flag-driven feature for generating Cloze items with Gemini before local spaCy fallback.

## Enable
Add to `.env` (or docker-compose `environment:`):

```
AI_CLOZE_ENABLED=true
GOOGLE_API_KEY=your_key_here
```
Rebuild or restart backend & worker containers.

## Behavior
1. Attempts AI JSON generation (up to N items, adaptive by text length).
2. Validates each item (single blank, tokens appear in source, 3 distractors).
3. Persists items with `meta.source = "ai"`.
4. If fewer than ~50% of target produced, falls back to local generator for remainder.

## Verification
- Watch logs: `[AI Cloze] Created X items` and optional fallback line.
- Inspect DB via Django shell:
```python
from API.models import Document, Cloze
D=Document.objects.last()
list(Cloze.objects.filter(document=D).values('id','text_with_blank','meta')[:5])
```

## Disable
Set `AI_CLOZE_ENABLED=false` (default) and restart.

## Notes
- Model: `gemini-2.5-flash` for speed/cost.
- Truncates source to 16000 chars to keep prompt size bounded.
- Safe JSON parsing with fallback regex.
