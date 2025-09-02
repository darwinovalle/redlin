from dotenv import load_dotenv
from .models import Document, Summary, Flashcard, MCQ, Cloze
from PyPDF2 import PdfReader
import google.generativeai as genai
import os
import re
import time
import random
import json
from django.db import transaction
from CORE.services.cloze_generator import ClozeGenerator

# ---------------------------------------------------------------------------
# Environment / Model configuration
# ---------------------------------------------------------------------------
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
# Use a fast, lower-cost model variant; adjust if needed.
model = genai.GenerativeModel("gemini-2.5-flash")

# ---------------------------------------------------------------------------
# Language detection helpers (restored)
# ---------------------------------------------------------------------------
SPANISH_COMMON = {"el","la","de","que","y","en","a","los","se","del","las","un","por","con","una","su","para","es","al","lo","como","más","pero","sus","le"}
ENGLISH_COMMON = {"the","and","to","of","in","that","it","is","for","on","as","are","was","with","this","by","an","be","or","from"}

def detect_language(text: str) -> str:
    """Light heuristic comparing counts of common function words."""
    if not text:
        return "other"
    words = re.findall(r"[a-záéíóúüñ]+", text.lower())
    if not words:
        return "other"
    es_count = sum(1 for w in words if w in SPANISH_COMMON)
    en_count = sum(1 for w in words if w in ENGLISH_COMMON)
    if es_count >= 3 and es_count > en_count * 1.2:
        return "es"
    if en_count >= 3 and en_count > es_count * 1.2:
        return "en"
    return "other"


def _parse_retry_delay_seconds(error_message: str) -> int | None:
    """Try to extract retry_delay seconds from Gemini error string."""
    try:
        m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_message)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return None


def generate_with_retry(prompt: str, *, max_attempts: int = 3, base_wait: int = 5):
    """
    Call Gemini generate_content with simple backoff for 429/quota errors.
    - Respects retry_delay seconds from the error if present.
    - Exponential backoff with jitter otherwise.
    """
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return model.generate_content(prompt)
        except Exception as e:
            msg = str(e)
            # Heuristics for quota/rate-limit
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                suggested = _parse_retry_delay_seconds(msg)
                wait = suggested if suggested is not None else min(60, base_wait * (2 ** (attempt - 1)))
                # small jitter to avoid thundering herd
                wait = int(wait + random.uniform(0, 0.2) * wait)
                print(f"[RateLimit] Attempt {attempt}/{max_attempts} failed. Waiting {wait}s before retry.")
                time.sleep(wait)
                last_exc = e
                continue
            # Other errors: re-raise immediately
            raise
    # Exhausted retries
    if last_exc:
        raise last_exc
    raise RuntimeError("Generation failed without exception detail")


def _ai_cloze_prompt(source_text: str, *, desired_count: int, words_per_item: int, lang_label: str) -> str:
    """Build prompt for AI Cloze generation (dynamic scaling)."""
    language_line = "Idioma de salida: Español" if lang_label == "Spanish" else "Output language: English"
    snippet = source_text[:16000]
    return (
        f"You are an expert educational content generator.\n"
        f"Generate as many high-quality fill-in-the-blank items (Cloze) as there are DISTINCT key concepts in the SOURCE TEXT.\n"
    f"Guideline: about 1 item per ~{words_per_item} words (estimated target ≈ {desired_count}). Continue until additional items would be redundant.\n"
    "Prioritize: core definitions → causal relations → processes → contrasts → implications.\n"
    "Skip trivial filler (articles, pronouns, purely structural verbs, generic words like 'thing', 'people').\n"
    "Each answer must be pedagogically valuable (concept, entity, process, mechanism, quantitative fact).\n"
    "Avoid making blanks out of stopwords, common verbs (be/have/do), or numbers unless they are key data points.\n\n"
        "REQUIREMENTS:\n"
        "- Each item has exactly one blank represented by the four underscores token: ____\n"
        "- Sentence must be concise, pedagogically meaningful (avoid over-long verbatim copying).\n"
        "- Blank hides a key term/concept present EXACTLY in the text.\n"
        "- All 3 distractors also appear in the text and share semantic / POS class with answer.\n"
        "- No duplicate answers or duplicate sentences.\n"
        "- Difficulty: easy | medium | hard.\n"
    "- Provide a MIX of difficulties; harder = abstraction, multi-step reasoning, rarity.\n"
    "- Stop BEFORE producing near-duplicates or overly narrow paraphrases.\n\n"
        "OUTPUT STRICT JSON ONLY (no markdown fences) with schema:\n"
        "{\n  \"clozes\": [\n     {\n       \"text\": \"La célula contiene ____ que protege el material genético.\",\n       \"answer\": \"núcleo\",\n       \"distractors\": [\"citoplasma\",\"membrana\",\"ribosoma\"],\n       \"difficulty\": \"medium\"\n     }\n  ]\n}\n\n"
        "VALIDATION RULES:\n"
        "- 'text' has exactly one '____'.\n"
        "- answer + distractors all appear in SOURCE TEXT.\n"
        "- Exactly 3 distractors.\n"
    "- Answer is NOT a stopword / trivial function word.\n"
        "- No trailing commas, no extra keys, no wrapper prose.\n\n"
        f"{language_line}\n\n"
        "SOURCE TEXT (truncated):\n"
        f"{snippet}"
    )


def _clean_ai_json(raw: str) -> dict | None:
    """Extract JSON from raw model output.
    - Tries direct json.loads
    - If fails, regex to capture first {...} block
    Returns dict or None.
    """
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    # Remove common wrappers (markdown fences, language hints)
    if raw.startswith("```"):
        # strip first and last fence
        parts = raw.split("```")
        raw = "\n".join(p for p in parts if 'clozes' in p or '{' in p)
        raw = raw.strip()
    # Try to locate a JSON object containing "clozes"
    obj = _extract_json_block(raw, key_hint='"clozes"')
    if obj:
        try:
            return json.loads(obj)
        except Exception:
            return None
    return None


def _extract_json_block(text: str, key_hint: str) -> str | None:
    """Attempt to extract a balanced JSON object that contains key_hint.
    Scans for first '{' and tries to balance braces.
    """
    start_candidates = [m.start() for m in re.finditer(r'\{', text)]
    for start in start_candidates:
        if key_hint not in text[start:]:
            continue
        depth = 0
        for i, ch in enumerate(text[start:], start=start):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start:i+1].strip()
                    if key_hint in candidate:
                        return candidate
                    break
    return None


def generate_ai_clozes(document: Document, source_text: str, lang_label: str, *, max_items: int, words_per_item: int) -> list[Cloze]:
    """AI-first Cloze generation.
    Returns created Cloze list (may be empty). Falls back to empty on parse/validation failure.
    """
    debug = os.getenv("AI_CLOZE_DEBUG", "0").lower() in {"1","true","yes","on"}
    base_prompt = _ai_cloze_prompt(source_text, desired_count=max_items if max_items>0 else 1000, words_per_item=words_per_item, lang_label=lang_label)
    attempts: list[tuple[str,str]] = [("primary", base_prompt)]
    # We will add a stricter second prompt if first fails to parse
    STRICT_SUFFIX = "\n\nIMPORTANT: Output ONLY the JSON object. Absolutely no prose, no explanation, no markdown fences."
    attempts.append(("strict", base_prompt + STRICT_SUFFIX))

    payload = None
    raw_text = ""
    for label, prompt in attempts:
        try:
            resp = generate_with_retry(prompt, max_attempts=2)
        except Exception as e:
            print(f"[AI Cloze] {label} generation failed: {e}")
            continue
        # Safely access text
        raw_text = getattr(resp, 'text', '') or ''
        if debug:
            print(f"[AI Cloze][{label}] Raw (first 300 chars): {raw_text[:300]!r}")
        payload = _clean_ai_json(raw_text)
        if payload and isinstance(payload, dict) and isinstance(payload.get('clozes'), list):
            break
        else:
            if debug:
                print(f"[AI Cloze][{label}] Could not parse JSON; will try next strategy.")
            payload = None

    if not payload:
        print("[AI Cloze] Invalid JSON structure after attempts")
        if debug and raw_text:
            print(f"[AI Cloze][debug] Last raw output tail: {raw_text[-300:]}" )
        return []

    created: list[Cloze] = []
    seen_sentences: set[str] = set()
    lowered_source = source_text.lower()
    limit = None if max_items <= 0 else max_items
    for item in (payload['clozes'] if limit is None else payload['clozes'][:limit]):
        if not isinstance(item, dict):
            continue
        text_val = str(item.get('text') or '').strip()
        answer = str(item.get('answer') or '').strip()
        distractors = item.get('distractors') or []
        difficulty = str(item.get('difficulty') or 'medium').lower()
        if text_val.count('____') != 1:
            continue
        if len(answer) < 2:
            continue
        if any(not isinstance(d, str) or len(d.strip()) < 2 for d in distractors):
            continue
        if len(distractors) != 3:
            continue
        # Validate presence in source
        if answer.lower() not in lowered_source:
            continue
        if any(d.lower() not in lowered_source for d in distractors):
            continue
        # Avoid duplicates
        norm_sentence = text_val.lower()
        if norm_sentence in seen_sentences:
            continue
        seen_sentences.add(norm_sentence)
        if difficulty not in {"easy","medium","hard"}:
            difficulty = "medium"
        try:
            c = Cloze.objects.create(
                document=document,
                text_with_blank=text_val,
                answer=answer,
                context='',
                source_span=answer,  # minimal trace; optional improvement: exact span search
                options=distractors,
                meta={"source":"ai","distractor_count": len(distractors)},
                difficulty=difficulty,
            )
            created.append(c)
        except Exception as e:
            print(f"[AI Cloze] Persist error: {e}")
    print(f"[AI Cloze] Created {len(created)} items (requested {max_items}).")
    return created

def process_pdf(document_id):
    document = Document.objects.get(id=document_id)
    if document.processing_status == 'completed':
        print(f"Document {document_id} already processed. Skipping.")
        return

    document.processing_status = 'processing'
    document.save()
    print(f"Processing document: {document.title} (ID: {document_id})")

    try:
        print("Extracting text from PDF...")
        reader = PdfReader(document.pdf_file.path)
        text = " ".join(page.extract_text() for page in reader.pages if page.extract_text())
        print(f"Extracted {len(text)} characters.")

        if not text.strip():
            print("No text extracted from PDF.")
            raise ValueError("Could not extract text from PDF")

        # Detect language
        dominant = detect_language(text)
        if dominant in ("en", "es"):
            target_lang = dominant
        else:
            target_lang = "en"

        lang_label = "English" if target_lang == "en" else "Spanish"
        output_lang_instruction = (
            "Produce la salida en Español." if target_lang == "es" else "Produce the output in English."
        )

        # ---- Generate Comprehensive Summary ----
        print("Generating summary...")
        doc_title = (document.title or "Document").strip()
        summary_prompt = f"""
You are an expert academic summarizer. {output_lang_instruction}

GOAL
Produce a high-signal, chapter/section-structured summary that captures the core intellectual substance of the source.

OUTPUT FORMAT (Pure Markdown only)
- First line MUST be exactly an H1 with the document title:
  # {doc_title}
- After the title, output the structured summary only. No preamble, no meta text, no “analysis”.
- Use section headings as H2 (“##”), each starting with ONE emoji + space + concise heading (no trailing punctuation).
- Under each heading, use dense bullets ("- ") OR tight mini paragraphs.
- Final section must be:
  ## ⭐ Key Takeaways
  - 5–12 distilled bullets (no redundancy).

CONTENT RULES (Absolute)
- Omit front matter: copyright notices, ISBN, disclaimers, dedications, acknowledgments (unless containing indispensable definitions).
- Preserve the source’s logic and argument flow; merge or skip low-value sections.
- No hallucinations. Only include concepts supported by the source.
- Remove repetition and ornamental filler; keep mechanisms, definitions, claims, evidence, results, implications, limitations.
- Include concrete numbers, definitions, and conditions when present; keep units and constraints.
- Use brief emphasis for pivotal terms (bold) sparingly. Use inline code `like_this` for terms, variables, or API names when appropriate.
- Tables are allowed if they clarify comparisons or taxonomies.
- Forbidden phrases anywhere: "Here is", "This book", "The document", "This section".
- Output language: {lang_label}
- If negligible substance after filtering: output:
  # {doc_title}

  (No substantive content found in provided excerpt.)

STRUCTURE GUIDANCE (Use as applicable)
- Start with the most structural or conceptual sections first (map to chapters/sections if present).
- For empirical work: Methods, Data, Results, Interpretation, Limitations.
- For theory: Core Claims, Definitions, Mechanisms, Propositions, Implications.
- For math/proofs: Theorem/Claim, Assumptions, Sketch of Proof, Corollaries, Scope.
- For code/APIs: Components, Interfaces, Invariants, Complexity, Example Usage.
- For dialogues/debates: Positions by speaker/side, Points of agreement, Disagreements, Evidence.
- For literature/essays: Thesis, Motifs/Themes, Structure/Arc, Key Passages (quoted minimally), Interpretation.

DENSITY & LENGTH
- Favor high information density; avoid sentence padding.
- Generally 4–10 sections total; 2–8 bullets per section depending on source length.

QUALITY CHECK (silent, do not output)
- H1 title present and correct.
- Headings are “## ” + one emoji + space + concise title.
- No preamble/meta/explanations.
- No forbidden phrases.
- No unsupported claims; numbers/definitions preserved.
- Ends with “## ⭐ Key Takeaways” (5–12 bullets).

SOURCE TEXT (for analysis; paraphrase in output)
{text}
"""
        try:
            summary_response = generate_with_retry(summary_prompt, max_attempts=3)
            summary_content = summary_response.text
        except Exception as e:
            summary_content = f"Title: {doc_title}\n\n(No substantive content found due to generation error.)"
            print(f"[Error] Failed to generate summary: {e}")
        Summary.objects.update_or_create(
            document=document,
            defaults={'content': summary_content}
        )
        print("Summary created/updated.")

        # ---- Generate Flashcards ----
        print("Generating flashcards...")
        flashcard_prompt = f"""
You are an expert in cognitive science and educational material design. Your task is to extract ALL learnable knowledge from the provided text and convert it into optimal flashcards.

Language: {lang_label}

CRITICAL REQUIREMENTS:

1. **COMPREHENSIVE EXTRACTION** (MANDATORY):
   - Create flashcards for EVERY significant piece of knowledge in the text
   - Systematic coverage: terms → concepts → relationships → principles → applications
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
            flashcard_response = generate_with_retry(flashcard_prompt, max_attempts=3)
            flashcards_raw = flashcard_response.text
            flashcard_blocks = flashcards_raw.strip().split('\n\n')

            # Parse first into in-memory objects
            new_flashcards = []
            for block in flashcard_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 2:
                    term_line = lines[0]
                    def_line = lines[1]
                    if term_line.startswith('Term:') and def_line.startswith('Definition:'):
                        term = term_line.replace('Term:', '').strip()
                        definition = def_line.replace('Definition:', '').strip()
                        if term and definition:
                            new_flashcards.append(Flashcard(document=document, key_term=term, definition=definition))
                        else:
                            print(f"[Data Info] Skipping flashcard block due to empty term/definition after parsing: {block}")
                    else:
                        print(f"[Parsing Error] Skipping flashcard block, incorrect line prefixes: {block}")
                elif block.strip():
                    print(f"[Parsing Error] Skipping flashcard block, expected 2 lines but got {len(lines)}: {block}")

            # Replace only if we have new content
            if new_flashcards:
                with transaction.atomic():
                    Flashcard.objects.filter(document=document).delete()
                    Flashcard.objects.bulk_create(new_flashcards)
                print(f"Created {len(new_flashcards)} flashcards.")
            else:
                print("[Info] No valid flashcards parsed. Keeping existing ones.")

        except Exception as e:
            print(f"[Error] Failed to generate or parse flashcards: {e}")

        # ---- Generate MCQs ----
        print("Generating MCQs...")
        mcq_prompt = f"""
You are an expert assessment designer specializing in educational content analysis.

TASK: Extract and convert ALL testable knowledge from the provided text into multiple-choice questions.

Language: {lang_label}

CRITICAL REQUIREMENTS:

1. **EXHAUSTIVE COVERAGE** (MANDATORY):
   - Create questions for EVERY significant concept, fact, relationship, or principle in the text
   - If a concept can be tested, it MUST have a question
   - Scan systematically: definitions → processes → relationships → applications → implications

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
            mcq_response = generate_with_retry(mcq_prompt, max_attempts=3)
            mcqs_raw = mcq_response.text
            mcq_blocks = mcqs_raw.strip().split('\n\n')

            new_mcqs = []
            for block in mcq_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 5:  # Expecting Q, A, B, C, D
                    q_line, a_line, b_line, c_line, d_line = lines

                    if q_line.startswith('Q:') and a_line.startswith('A:') and b_line.startswith('B:') and c_line.startswith('C:') and d_line.startswith('D:'):
                        question = q_line.replace('Q:', '').strip()
                        correct_answer = a_line.replace('A:', '').strip()
                        option_1 = b_line.replace('B:', '').strip()  # Map B to option_1
                        option_2 = c_line.replace('C:', '').strip()  # Map C to option_2
                        option_3 = d_line.replace('D:', '').strip()  # Map D to option_3

                        if question and correct_answer and option_1 and option_2 and option_3:
                            new_mcqs.append(MCQ(
                                document=document,
                                question=question,
                                correct_answer=correct_answer,
                                option_1=option_1,
                                option_2=option_2,
                                option_3=option_3
                            ))
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
            else:
                print("[Info] No valid MCQs parsed. Keeping existing ones.")

        except Exception as e:
            print(f"[Error] Failed to generate or parse MCQs: {e}")

        # ---- Generate Cloze (AI-first with fallback to spaCy) ----
        try:
            print("Generating Cloze items (AI-first)...")
            # Dynamic sizing: allow override & unlimited
            ai_enabled = os.getenv("AI_CLOZE_ENABLED", "false").lower() in {"1","true","yes","on"}
            words = text.split()
            default_words_per_item = int(os.getenv("AI_CLOZE_WORDS_PER_ITEM", "120"))
            # Estimate desired count (floor) if not unlimited
            unlimited = os.getenv("AI_CLOZE_MAX", "").strip() == "0"
            estimated = max(4, len(words)//default_words_per_item) if not unlimited else 0
            max_cap_env = os.getenv("AI_CLOZE_MAX", "")
            if max_cap_env.isdigit() and int(max_cap_env) > 0:
                estimated = min(estimated, int(max_cap_env))
            approx_items = estimated if estimated else 0  # 0 signals unlimited
            created_ai: list[Cloze] = []
            if ai_enabled:
                # Provide summary + a slice of original text to balance abstraction + coverage
                combined_source = (summary_content or "") + "\n\n" + text[:10000]
                created_ai = generate_ai_clozes(document, combined_source, lang_label, max_items=approx_items, words_per_item=default_words_per_item)
            # If limited mode and sparse yield -> fallback fill
            if approx_items > 0 and len(created_ai) < max(1, approx_items // 2):  # Fallback enrich if AI sparse
                print("[AI Cloze] Fallback to local generator for remaining items...")
                remaining = approx_items - len(created_ai)
                if remaining > 0:
                    cgen = ClozeGenerator(document, max_items=remaining)
                    local_items = cgen.generate()
                    print(f"[Cloze Fallback] Added {len(local_items)} local items.")
            total_clozes = document.clozes.count()
            print(f"Total Cloze items now: {total_clozes}.")
        except Exception as e:
            print(f"[Error] Cloze AI/local generation failed: {e}")

        # ---- Finalize ----
        document.processing_status = 'completed'
        document.save()
        print(f"Successfully processed document {document.id}.")

    except Exception as e:
        print(f"[Fatal Error] Processing failed for document {document.id}: {e}")
        # Revert status to pending or set to failed on fatal error
        try:
            doc_to_update = Document.objects.get(id=document_id)
            doc_to_update.processing_status = 'failed' # Or 'pending'
            doc_to_update.save()
        except Document.DoesNotExist:
            print(f"Document {document_id} not found for status update after error.")
        # Re-raise the exception if you want the task runner (e.g., Celery) to know it failed
        # raise e