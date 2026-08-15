import json

from API.models import User
from API.services.processing_common import detect_language, extract_json_block, generate_with_retry
from CORE.services.srs import record_feynman_review

from ..models import ClassSessionFeynman, ClassSessionFeynmanAttempt


def _normalized_answer(answer: str) -> str:
    return ' '.join((answer or '').strip().split())


def _normalize_key_points(key_points) -> list[str]:
    normalized = []
    for item in key_points or []:
        if isinstance(item, dict):
            normalized.append(str(item.get('point') or item.get('text') or item.get('idea') or item))
        else:
            normalized.append(str(item))
    return normalized


def _prompt_language(f_obj: ClassSessionFeynman) -> str:
    # English-only feedback for now (Spanish support deferred).
    return "en"


def evaluate_and_record_attempt(*, f_obj: ClassSessionFeynman, answer: str, user: User) -> ClassSessionFeynmanAttempt:
    attempt = ClassSessionFeynmanAttempt.objects.create(
        class_session=f_obj.class_session,
        feynman=f_obj,
        user=user,
        answer_text=_normalized_answer(answer),
    )

    language = _prompt_language(f_obj)
    rubric_lang_prefix = 'Return the feedback in English.'

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

QUESTION / PROMPT:
{f_obj.prompt}

KEY POINTS (with weight):
{json.dumps(f_obj.key_points, ensure_ascii=False)}

LEARNER ANSWER:
{attempt.answer_text}

REQUIREMENTS:
- Parse key point coverage (matched vs missing) using semantic judgment.
- Compute intermediate metrics (0..1) for coverage, accuracy, clarity, simplicity.
- Compute penalty fractions (0..1) for misconceptions and hallucinations.
- Final score = round(100 * (0.4*coverage + 0.25*accuracy + 0.15*clarity + 0.10*simplicity - 0.10*misconceptions_penalty - 0.10*hallucination_penalty)). Clamp 1..100.
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
  "matched_key_points": [1, 2, 4],
  "missing_key_points": [3],
  "feedback": "Texto breve de retroalimentación."
}}
NO markdown fences. NO commentary outside JSON.
"""

    try:
        response = generate_with_retry(eval_prompt, max_attempts=2, user_id=user.id)
        raw = getattr(response, 'text', '') or ''
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
            attempt.key_points_coverage = max(0.0, min(1.0, len(matched) / total))
        attempt.save()
        # Feed the graded answer into the SM-2 schedule (keyed on the prompt).
        record_feynman_review(
            user=user, prompt=f_obj, answer_text=attempt.answer_text, score=attempt.score,
        )
    except Exception as exc:
        print(f"[ClassroomFeynmanEval] Error: {exc}")

    return attempt
