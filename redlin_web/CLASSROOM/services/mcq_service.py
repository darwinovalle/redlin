import json
import random
import re
import logging
from django.db import transaction
from API.services.processing_common import generate_with_retry
from CLASSROOM.models import ClassSession, ClassSessionMCQ

logger = logging.getLogger(__name__)

# Keep every LLM response small so it always fits under the provider's output
# token limit. Large transcripts previously produced an "exhaustive" MCQ JSON
# that got truncated mid-array -> invalid JSON -> parse failure -> zero MCQs.
# So: bounded questions per call, and the source text is split into chunks that
# are generated separately and merged.
MCQS_PER_BATCH = 8
MAX_TOTAL_MCQS = 30
CHUNK_CHARS = 3500

MCQ_PROMPT = """You are an expert assessment designer specializing in educational content analysis.

TASK: Create up to {limit} multiple-choice questions based ONLY on the provided text.
Language: {lang_label}

CRITICAL REQUIREMENTS:
1. Focus on the MOST IMPORTANT concepts, facts, or principles in the text — quality over exhaustiveness.
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


def _split_text(text: str, chunk_chars: int = CHUNK_CHARS) -> list[str]:
    """Split long transcripts into sentence-aware chunks so each LLM call stays small."""
    if len(text) <= chunk_chars:
        return [text]
    parts = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current = ""
    for part in parts:
        if current and len(current) + len(part) + 1 > chunk_chars:
            chunks.append(current)
            current = part
        else:
            current = (current + " " + part).strip() if current else part
    if current:
        chunks.append(current)
    return chunks


def _extract_json_array(raw: str) -> str:
    """Return only the outermost JSON array (drops any model preamble/trailer)."""
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return raw
    return raw[start : end + 1]


def _repair_json(raw: str) -> str:
    """Fix the most common LLM JSON mistakes: trailing commas and unquoted keys."""
    repaired = _extract_json_array(raw)
    # remove trailing commas before } or ]
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
    # quote unquoted object keys (e.g. {question: "..."})
    repaired = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', repaired)
    return repaired


def _parse_mcq_items(raw: str) -> list[dict]:
    """Parse + structurally validate the model's JSON array, with a repair retry."""
    cleaned = raw.strip()
    # Strip markdown fences if the model wraps anyway (defensive)
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[: cleaned.rfind("```")].strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        data = json.loads(_repair_json(cleaned))

    if not isinstance(data, list):
        raise ValueError(f"Expected a JSON array, got {type(data).__name__}")
    return data


def generate_session_mcqs(class_session: ClassSession, text: str, lang_label: str) -> int:
    cleaned = (text or "").strip()
    if not cleaned:
        logger.warning("[MCQ] Session %s: empty text, nothing to generate.", class_session.id)
        return 0

    chunks = _split_text(cleaned)
    seen_questions = set()
    new_mcqs: list[ClassSessionMCQ] = []

    for chunk_index, chunk in enumerate(chunks):
        prompt = MCQ_PROMPT.format(limit=MCQS_PER_BATCH, lang_label=lang_label, text=chunk)
        try:
            response = generate_with_retry(prompt, max_attempts=3, user_id=class_session.user_id)
            mcq_data = _parse_mcq_items(response.text.strip())
        except Exception as exc:  # per-chunk failure must not kill the whole session
            logger.error(
                "[MCQ] Session %s chunk %d/%d failed: %s",
                class_session.id,
                chunk_index + 1,
                len(chunks),
                exc,
            )
            continue

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

                # Deduplicate across chunks by normalized question text.
                key = question.casefold()
                if key in seen_questions:
                    skipped += 1
                    continue
                seen_questions.add(key)

                # Shuffle so the correct answer isn't always in the same slot
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
                    "[MCQ] Session %s chunk %d: skipped item %d — %s — raw: %s",
                    class_session.id,
                    chunk_index + 1,
                    i,
                    item_err,
                    str(item)[:200],
                )
        if skipped:
            logger.warning(
                "[MCQ] Session %s chunk %d: %d items skipped out of %d.",
                class_session.id,
                chunk_index + 1,
                skipped,
                len(mcq_data),
            )

    # Cap the total so the study space stays focused.
    if len(new_mcqs) > MAX_TOTAL_MCQS:
        new_mcqs = new_mcqs[:MAX_TOTAL_MCQS]

    if new_mcqs:
        with transaction.atomic():
            ClassSessionMCQ.objects.filter(class_session=class_session).delete()
            ClassSessionMCQ.objects.bulk_create(new_mcqs)
        logger.info("[MCQ] Session %s: saved %d MCQs across %d chunk(s).", class_session.id, len(new_mcqs), len(chunks))
        return len(new_mcqs)

    logger.warning("[MCQ] Session %s: no valid MCQs were generated across %d chunk(s).", class_session.id, len(chunks))
    return 0
