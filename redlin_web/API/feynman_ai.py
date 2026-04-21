import json
from typing import Optional
from .models import Feynman, FeynmanAttempt, User
from .services.processing_common import detect_language, extract_json_block, generate_with_retry

def evaluate_document_feynman_attempt(f_obj: Feynman, answer: str, user: User) -> FeynmanAttempt:
    """Create + evaluate a FeynmanAttempt for a Document Feynman prompt.

    Uses the same rubric as existing view logic but centralized for reuse
    by both the legacy /api/feynman/attempt and new nested endpoint
    /api/documents/{id}/feynman/evaluate/.
    """
    attempt = FeynmanAttempt.objects.create(
        document=f_obj.document,
        feynman=f_obj,
        user=user,
        answer_text=' '.join(answer.strip().split()),
    )
    lang = detect_language(f_obj.prompt + ' ' + ' '.join(kp.get('point','') if isinstance(kp, dict) else str(kp) for kp in f_obj.key_points))
    rubric_lang_prefix = 'Devuelve la respuesta en Español.' if lang == 'es' else 'Return the feedback in English.'
    eval_prompt = f"""
You are an expert tutor applying a strict Feynman explanation rubric.
{rubric_lang_prefix}

SCORING RANGE: 1-100 integer.
TIERS:
- <60 = deficiente
- 60-79 = aceptable
- 80-100 = sobresaliente

RUBRIC DIMENSIONS (weight guidance):
- coverage: Did the answer include the key points (match / paraphrase) (40%).
- accuracy: Correctness of statements (25%).
- clarity: Clear, coherent explanation accessible to a novice (15%).
- simplicity: Avoids unnecessary jargon, breaks ideas down (10%).
- misconceptions_penalty: Deduct for incorrect statements (-10%).
- hallucination_penalty: Deduct for invented facts (-10%).

KEY POINTS (with weight):
{json.dumps(f_obj.key_points, ensure_ascii=False)}

LEARNER ANSWER:
{attempt.answer_text}

REQUIREMENTS:
- Parse key point coverage (matched vs missing) using semantic judgment.
- Compute intermediate metrics (0..1) for coverage, accuracy, clarity, simplicity.
- Compute penalty fractions (0..1) for misconceptions and hallucinations.
- Final score = round( 100 * (0.4*coverage + 0.25*accuracy + 0.15*clarity + 0.10*simplicity - 0.10*misconceptions_penalty - 0.10*hallucination_penalty) ). Clamp 1..100.
- Provide short feedback (2-4 sentences) with actionable improvements.
- STRICT JSON OUTPUT ONLY:
{{
  "score": 88,
  "coverage": 0.75,
  "accuracy": 0.80,
  "clarity": 0.9,
  "simplicity": 0.8,
  "misconceptions_penalty": 0.0,
  "hallucination_penalty": 0.1,
  "matched_key_points": [1,2,4],
  "missing_key_points": [3],
  "feedback": "Texto breve de retroalimentación."
}}
NO markdown fences. NO commentary outside JSON.
"""
    try:
        resp = generate_with_retry(eval_prompt, max_attempts=2)
        raw = getattr(resp, 'text', '') or ''
        data = None
        try:
            data = json.loads(raw.strip())
        except Exception:
            block = extract_json_block(raw, '"score"')
            if block:
                try:
                    data = json.loads(block)
                except Exception:
                    data = None
        if not data or 'score' not in data:
            return attempt
        attempt.score = int(max(1, min(100, data.get('score', 1))))
        attempt.breakdown = data
        matched = data.get('matched_key_points') or []
        total = len(f_obj.key_points)
        if total > 0 and isinstance(matched, list):
            attempt.key_points_coverage = max(0.0, min(1.0, len(matched)/total))
        attempt.save()
    except Exception as e:
        print(f"[DocFeynmanEval] Error: {e}")
    return attempt
