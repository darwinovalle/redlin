from django.db import transaction

from API.models import Document, Flashcard

from .processing_common import generate_with_retry


def generate_flashcards(document: Document, text: str, lang_label: str) -> int:
    """Generate and persist flashcards; returns number of created cards."""
    print("Generating flashcards...")
    flashcard_prompt = f"""
You are an expert in cognitive science and educational material design. Your task is to extract ALL learnable knowledge from the provided text and convert it into optimal flashcards.

Language: {lang_label}

CRITICAL REQUIREMENTS:

1. **COMPREHENSIVE EXTRACTION** (MANDATORY):
   - Create flashcards for EVERY significant piece of knowledge in the text
   - Systematic coverage: terms -> concepts -> relationships -> principles -> applications
   - If something is worth knowing, it needs a flashcard

2. **FLASHCARD TYPES** (use all that apply):
   - **Term/Definition**: Core vocabulary and concepts
   - **Fact/Explanation**: Important statements and their significance
   - **Question/Answer**: Critical relationships and causations
   - **Principle/Application**: Rules and how they work in practice

3. **QUALITY STANDARDS**:
   - Front side: Specific, testable prompt (1-7 words ideal)
   - Back side: Complete but concise answer (1-3 sentences max)
   - Each card tests ONE atomic piece of knowledge
   - No ambiguity - the answer must be clear and unique

4. **CONTENT RULES**:
   - INCLUDE: All definitions, formulas, processes, key relationships, important facts
   - EXCLUDE: Publication metadata, author bios, dedications, trivial examples
   - Transform complex ideas into multiple simple cards

5. **OPTIMIZATION FOR MEMORY**:
   - Use active recall format (not just passive definitions)
   - Include context clues when necessary
   - Break compound concepts into atomic units

6. **EXACT FORMAT** (no deviations):
   Term: <Front of card - what to recall>
   Definition: <Back of card - the answer>

   [blank line between each flashcard]

7. **COVERAGE CHECK**:
   Before finalizing, verify: Have I captured every important concept, relationship, and fact from the text?

DOCUMENT TEXT:
{text}
"""

    try:
        flashcard_response = generate_with_retry(flashcard_prompt, max_attempts=3, user_id=document.user_id)
        flashcards_raw = flashcard_response.text
        flashcard_blocks = flashcards_raw.strip().split("\n\n")

        new_flashcards: list[Flashcard] = []
        for block in flashcard_blocks:
            lines = block.strip().split("\n")
            if len(lines) == 2:
                term_line = lines[0]
                def_line = lines[1]
                if term_line.startswith("Term:") and def_line.startswith("Definition:"):
                    term = term_line.replace("Term:", "").strip()
                    definition = def_line.replace("Definition:", "").strip()
                    if term and definition:
                        new_flashcards.append(
                            Flashcard(document=document, key_term=term, definition=definition)
                        )
                    else:
                        print(
                            "[Data Info] Skipping flashcard block due to empty term/definition after parsing:"
                            f" {block}"
                        )
                else:
                    print(f"[Parsing Error] Skipping flashcard block, incorrect line prefixes: {block}")
            elif block.strip():
                print(
                    f"[Parsing Error] Skipping flashcard block, expected 2 lines but got {len(lines)}: {block}"
                )

        if new_flashcards:
            with transaction.atomic():
                Flashcard.objects.filter(document=document).delete()
                Flashcard.objects.bulk_create(new_flashcards)
            print(f"Created {len(new_flashcards)} flashcards.")
            return len(new_flashcards)

        print("[Info] No valid flashcards parsed. Keeping existing ones.")
    except Exception as exc:
        print(f"[Error] Failed to generate or parse flashcards: {exc}")
    return 0
