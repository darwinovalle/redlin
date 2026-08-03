import re
from django.db import transaction

from API.models import Document, MCQ

from .processing_common import generate_with_retry

# Keep every LLM response small so it always fits under the provider's output
# token limit. Large documents previously produced an "exhaustive" MCQ dump that
# got truncated -> blocks lost -> few/no MCQs. Now: bounded per call + the source
# text is split into chunks that are generated separately and merged.
MCQS_PER_BATCH = 8
MAX_TOTAL_MCQS = 30
CHUNK_CHARS = 3500


def _split_text(text: str, chunk_chars: int = CHUNK_CHARS) -> list[str]:
    """Split long documents into sentence-aware chunks so each LLM call stays small."""
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


def _parse_mcq_blocks(raw: str) -> list[dict]:
    """Parse Q:/A:/B:/C:/D: blocks from the model's response (lenient — skips malformed)."""
    items = []
    for block in re.split(r"\n\s*\n", raw or ""):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) != 5:
            continue
        labels = [line.split(":", 1) for line in lines]
        if not all(len(part) == 2 and part[0].strip() in ("Q", "A", "B", "C", "D") for part in labels):
            continue
        question = labels[0][1].strip()
        correct = labels[1][1].strip()
        o1 = labels[2][1].strip()
        o2 = labels[3][1].strip()
        o3 = labels[4][1].strip()
        if question and correct and o1 and o2 and o3:
            items.append({
                "question": question,
                "correct_answer": correct,
                "option_1": o1,
                "option_2": o2,
                "option_3": o3,
            })
    return items


def generate_mcqs(document: Document, text: str, lang_label: str) -> int:
    """Generate and persist MCQs; returns number of created questions."""
    print("Generating MCQs...")
    cleaned = (text or "").strip()
    if not cleaned:
        print("[Info] Empty text — nothing to generate.")
        return 0

    mcq_prompt_template = """
You are an expert assessment designer specializing in educational content analysis.

TASK: Create up to {limit} multiple-choice questions based ONLY on the provided text.
Language: {lang_label}

CRITICAL REQUIREMENTS:

1. Focus on the MOST IMPORTANT concepts, facts, relationships, or principles in the text — quality over exhaustiveness.
2. **ACCURACY GUARANTEE**:
   - Double-check each correct answer against the source text
   - The correct answer must be 100% verifiable from the text
   - If uncertain about factual accuracy, skip that question

3. **QUESTION TYPES** (use a mix):
   - Definitional: "What is X?"
   - Causal: "Why does X lead to Y?"
   - Comparative: "How does X differ from Y?"
   - Applied: "In situation Z, what would happen?"
   - Analytical: "Which statement best explains X?"

4. **DISTRACTOR RULES**:
   - Each incorrect option must be plausible but definitively wrong
   - Use common misconceptions, partial truths, or related-but-different concepts

5. **FORBIDDEN CONTENT**:
   - NO questions about: publication dates, ISBN, publisher, author bio, dedications, acknowledgments
   - NO "All/None of the above" or combination options
   - NO negatively-phrased questions ("Which is NOT...")

6. **EXACT FORMAT** (no deviations):
   Q: <Question text>
   A: <Correct Answer>
   B: <Incorrect Option 1>
   C: <Incorrect Option 2>
   D: <Incorrect Option 3>

   [blank line between each question block]

DOCUMENT TEXT:
{chunk}
"""

    try:
        chunks = _split_text(cleaned)
        new_mcqs: list[MCQ] = []
        seen_questions = set()
        for chunk_index, chunk in enumerate(chunks):
            prompt = mcq_prompt_template.format(limit=MCQS_PER_BATCH, lang_label=lang_label, chunk=chunk)
            try:
                mcq_response = generate_with_retry(prompt, max_attempts=3, user_id=document.user_id)
            except Exception as chunk_err:
                print(f"[MCQ] chunk {chunk_index + 1}/{len(chunks)} failed: {chunk_err}")
                continue
            for item in _parse_mcq_blocks(mcq_response.text):
                key = item["question"].casefold()
                if key in seen_questions:
                    continue
                seen_questions.add(key)
                new_mcqs.append(MCQ(document=document, **item))

        if len(new_mcqs) > MAX_TOTAL_MCQS:
            new_mcqs = new_mcqs[:MAX_TOTAL_MCQS]

        if new_mcqs:
            with transaction.atomic():
                MCQ.objects.filter(document=document).delete()
                MCQ.objects.bulk_create(new_mcqs)
            print(f"Created {len(new_mcqs)} MCQs across {len(chunks)} chunk(s).")
            return len(new_mcqs)

        print("[Info] No valid MCQs parsed. Keeping existing ones.")
    except Exception as exc:
        print(f"[Error] Failed to generate or parse MCQs: {exc}")
    return 0
