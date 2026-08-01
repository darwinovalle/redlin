from django.db import transaction

from API.models import Document, MCQ

from .processing_common import generate_with_retry


def generate_mcqs(document: Document, text: str, lang_label: str) -> int:
    """Generate and persist MCQs; returns number of created questions."""
    print("Generating MCQs...")
    mcq_prompt = f"""
You are an expert assessment designer specializing in educational content analysis.

TASK: Extract and convert ALL testable knowledge from the provided text into multiple-choice questions.

Language: {lang_label}

CRITICAL REQUIREMENTS:

1. **EXHAUSTIVE COVERAGE** (MANDATORY):
   - Create questions for EVERY significant concept, fact, relationship, or principle in the text
   - If a concept can be tested, it MUST have a question
   - Scan systematically: definitions -> processes -> relationships -> applications -> implications

2. **ACCURACY GUARANTEE**:
   - Double-check each correct answer against the source text
   - The correct answer must be 100% verifiable from the text
   - If uncertain about factual accuracy, skip that question

3. **QUESTION TYPES** (use all that apply):
   - Definitional: "What is X?"
   - Causal: "Why does X lead to Y?"
   - Comparative: "How does X differ from Y?"
   - Applied: "In situation Z, what would happen?"
   - Analytical: "Which statement best explains X?"

4. **DISTRACTOR RULES**:
   - Each incorrect option must be plausible but definitively wrong
   - Use common misconceptions, partial truths, or related-but-different concepts
   - Never use nonsensical or obviously wrong distractors

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

7. **QUALITY CHECKS**:
   - Before outputting, verify: Is the correct answer unambiguously right?
   - Are all distractors clearly wrong but believable?
   - Have I covered ALL major concepts from the text?

DOCUMENT TEXT:
{text}
"""

    try:
        mcq_response = generate_with_retry(mcq_prompt, max_attempts=3, user_id=document.user_id)
        mcqs_raw = mcq_response.text
        mcq_blocks = mcqs_raw.strip().split("\n\n")

        new_mcqs: list[MCQ] = []
        for block in mcq_blocks:
            lines = block.strip().split("\n")
            if len(lines) == 5:
                q_line, a_line, b_line, c_line, d_line = lines
                if (
                    q_line.startswith("Q:")
                    and a_line.startswith("A:")
                    and b_line.startswith("B:")
                    and c_line.startswith("C:")
                    and d_line.startswith("D:")
                ):
                    question = q_line.replace("Q:", "").strip()
                    correct_answer = a_line.replace("A:", "").strip()
                    option_1 = b_line.replace("B:", "").strip()
                    option_2 = c_line.replace("C:", "").strip()
                    option_3 = d_line.replace("D:", "").strip()

                    if question and correct_answer and option_1 and option_2 and option_3:
                        new_mcqs.append(
                            MCQ(
                                document=document,
                                question=question,
                                correct_answer=correct_answer,
                                option_1=option_1,
                                option_2=option_2,
                                option_3=option_3,
                            )
                        )
                    else:
                        print(f"[Data Info] Skipping MCQ block due to missing parts after parsing: {block}")
                else:
                    print(f"[Parsing Error] Skipping MCQ block, incorrect line prefixes: {block}")
            elif block.strip():
                print(f"[Parsing Error] Skipping MCQ block, expected 5 lines but got {len(lines)}: {block}")

        if new_mcqs:
            with transaction.atomic():
                MCQ.objects.filter(document=document).delete()
                MCQ.objects.bulk_create(new_mcqs)
            print(f"Created {len(new_mcqs)} MCQs.")
            return len(new_mcqs)

        print("[Info] No valid MCQs parsed. Keeping existing ones.")
    except Exception as exc:
        print(f"[Error] Failed to generate or parse MCQs: {exc}")
    return 0
