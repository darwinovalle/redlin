import json
import random
import logging
from django.db import transaction
from API.services.processing_common import generate_with_retry
from CLASSROOM.models import ClassSession, ClassSessionMCQ

logger = logging.getLogger(__name__)

MCQ_PROMPT = """You are an expert assessment designer specializing in educational content analysis.

TASK: Extract and convert ALL testable knowledge from the provided text into multiple-choice questions.
Language: {lang_label}

CRITICAL REQUIREMENTS:
1. EXHAUSTIVE COVERAGE: Create questions for EVERY significant concept, fact, or principle in the text.
2. ACCURACY GUARANTEE: The correct answer must be 100% verifiable from the source text. Do NOT invent facts.
3. DISTRACTOR RULES: Each incorrect option must be plausible but definitively wrong based on the text.
4. FORBIDDEN: No "All/None of the above", no negatively-phrased questions (avoid "Which is NOT...").
5. SELF-CONTAINED: Each question must be understandable without reading the other questions.

OUTPUT FORMAT — YOU MUST RETURN ONLY A VALID JSON ARRAY. NO PREAMBLE. NO EXPLANATION. NO MARKDOWN FENCES.

The JSON must be an array of objects, each with exactly these keys:
- "question": string — the question text
- "correct_answer": string — the one correct answer, taken directly from the source text
- "distractors": array of exactly 3 strings — the incorrect options

Example of the EXACT format required:
[
  {{
    "question": "What is the primary function of mitochondria?",
    "correct_answer": "To produce ATP through cellular respiration",
    "distractors": [
      "To synthesize proteins from amino acids",
      "To regulate the cell cycle and division",
      "To transport materials across the cell membrane"
    ]
  }}
]

SOURCE TEXT:
{text}

RETURN ONLY THE JSON ARRAY. NOTHING ELSE."""


def generate_session_mcqs(class_session: ClassSession, text: str, lang_label: str) -> int:
    prompt = MCQ_PROMPT.format(lang_label=lang_label, text=text)

    try:
        response = generate_with_retry(prompt, max_attempts=3, user_id=class_session.user_id)
        raw = response.text.strip()

        # Strip markdown fences if the model wraps anyway (defensive)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        if raw.endswith("```"):
            raw = raw[: raw.rfind("```")].strip()

        mcq_data = json.loads(raw)

        if not isinstance(mcq_data, list):
            raise ValueError(f"Expected a JSON array, got {type(mcq_data).__name__}")

        new_mcqs = []
        skipped = 0

        for i, item in enumerate(mcq_data):
            try:
                question = item["question"].strip()
                correct_answer = item["correct_answer"].strip()
                distractors = [d.strip() for d in item["distractors"]]

                if not question or not correct_answer:
                    raise ValueError("Empty question or correct_answer")
                if len(distractors) != 3:
                    raise ValueError(f"Expected 3 distractors, got {len(distractors)}")
                if any(not d for d in distractors):
                    raise ValueError("One or more distractors are empty")

                # Shuffle so correct answer isn't always in the same slot
                random.shuffle(distractors)

                new_mcqs.append(
                    ClassSessionMCQ(
                        class_session=class_session,
                        question=question,
                        correct_answer=correct_answer,
                        option_1=distractors[0],
                        option_2=distractors[1],
                        option_3=distractors[2],
                    )
                )
            except (KeyError, ValueError, TypeError) as item_err:
                skipped += 1
                logger.warning(
                    "[MCQ] Skipped item %d for session %s: %s — raw: %s",
                    i,
                    class_session.id,
                    item_err,
                    str(item)[:200],
                )

        if skipped:
            logger.warning(
                "[MCQ] Session %s: %d items skipped out of %d total.",
                class_session.id,
                skipped,
                len(mcq_data),
            )

        if new_mcqs:
            with transaction.atomic():
                ClassSessionMCQ.objects.filter(class_session=class_session).delete()
                ClassSessionMCQ.objects.bulk_create(new_mcqs)
            logger.info("[MCQ] Session %s: saved %d MCQs.", class_session.id, len(new_mcqs))
            return len(new_mcqs)

        logger.warning("[MCQ] Session %s: no valid MCQs were parsed.", class_session.id)

    except json.JSONDecodeError as e:
        logger.error(
            "[MCQ] Session %s: JSON parse failed — %s\nRaw response (first 500 chars): %s",
            class_session.id,
            e,
            raw[:500] if "raw" in locals() else "N/A",
        )
    except Exception as exc:
        logger.error("[MCQ] Session %s: unexpected error — %s", class_session.id, exc)

    return 0
