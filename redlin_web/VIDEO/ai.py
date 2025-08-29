import os
import re
import time
import random
from typing import List
from dotenv import load_dotenv
import google.generativeai as genai

from django.db import transaction
from .models import Video, VideoSummary, VideoMCQ
from .transcript_yt_dlp import fetch_transcript_yt_dlp, TranscriptError

load_dotenv()
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
_model = genai.GenerativeModel("gemini-2.5-flash")

_RE_RETRY = re.compile(r"retry_delay\s*\{\s*seconds:\s*(\d+)", re.I)

SPANISH_COMMON = {"el","la","de","que","y","en","a","los","se","del","las","un","por","con","una","su","para","es","al","lo","como","más","pero","sus","le"}
ENGLISH_COMMON = {"the","and","to","of","in","that","it","is","for","on","as","are","was","with","this","by","an","be","or","from"}

def _parse_retry_delay_seconds(msg: str):
    m = _RE_RETRY.search(msg)
    return int(m.group(1)) if m else None

def detect_language(text: str) -> str:
    """
    Heurística ligera: compara frecuencia de palabras funcionales.
    Devuelve 'en', 'es' u 'other'.
    """
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

def generate_with_retry(prompt: str, max_attempts: int = 3, base_wait: int = 5):
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return _model.generate_content(prompt)
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                suggested = _parse_retry_delay_seconds(msg)
                wait = suggested if suggested is not None else min(60, base_wait * (2 ** (attempt - 1)))
                wait = int(wait + random.uniform(0, 0.25) * wait)
                print(f"[Video RateLimit] intento {attempt}/{max_attempts}. Esperando {wait}s")
                time.sleep(wait)
                last_exc = e
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("Fallo de generación sin excepción detallada")

def _build_timestamp_reference(snippets):
    """
    Construye una sección compacta para ayudar al modelo a citar timestamps.
    Limita cada snippet a 140 chars.
    """
    lines = []
    for s in snippets:
        start = s["start"]
        mm = int(start // 60)
        ss = int(start % 60)
        ts = f"{mm:02d}:{ss:02d}"
        txt = (s["text"].replace("\n"," ").strip())[:140]
        lines.append(f"[{ts}] {txt}")
    return "\n".join(lines)

def _compute_target_mcq_count(full_text: str) -> int:
    words = full_text.split()
    # Aproximación: 1 MCQ por ~120 palabras. Límites 5..25
    target = max(5, min(25, len(words)//120 or 5))
    return target

def process_video(video_id_db: int, languages: List[str] | None = None):
    video = Video.objects.get(id=video_id_db)
    if video.processing_status == 'completed':
        print(f"[Video] {video.id} ya procesado.")
        return
    video.processing_status = 'processing'
    video.save()
    try:
        print(f"[Video] Obteniendo transcript (yt-dlp) {video.url}")
        # Pequeño retraso para mitigar bloqueos / rate limits (requisito)
        time.sleep(2)
        data = fetch_transcript_yt_dlp(video.url, languages=languages)
        snippets = data["snippets"]
        if data.get("title") and not video.title:
            video.title = data["title"][:255]
        video.video_id = data["video_id"]
        video.snippet_count = len(snippets)
        full_text = " ".join(s["text"] for s in snippets if s.get("text"))
        video.transcript_text = full_text
        video.save()

        if not full_text.strip():
            raise ValueError("Transcript vacío")

        # Detectar idioma dominante
        dominant = detect_language(full_text)
        if dominant in ("en", "es"):
            target_lang = dominant
        else:
            target_lang = "en"

        lang_label = "English" if target_lang == "en" else "Spanish"
        summary_heading_note = (
            "Produce la salida en Español." if target_lang == "es" else "Produce the output in English."
        )
        timestamp_ref = _build_timestamp_reference(snippets)
        target_mcq_count = _compute_target_mcq_count(full_text)

        summary_prompt = f"""

You are an expert academic summarizer. {summary_heading_note}

GOAL
Produce a high-signal, chapter/section-structured summary that captures the core intellectual substance of the source.

OUTPUT FORMAT (Pure Markdown only)
- First line MUST be exactly an H1 with the document title:
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
{full_text}

"""
        try:
            summary_resp = generate_with_retry(summary_prompt)
            summary_text = summary_resp.text
            VideoSummary.objects.update_or_create(
                video=video,
                defaults={"content": summary_text},
            )
        except Exception as e:
            print(f"[Video Error] Summary: {e}")

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
{full_text}
"""
        try:
            mcq_resp = generate_with_retry(mcq_prompt)
            raw = mcq_resp.text.strip()
            blocks = raw.split("\n\n")
            new_mcqs = []
            for block in blocks:
                lines = [l for l in block.strip().split("\n") if l.strip()]
                if len(lines) == 5 and all(l.split(":", 1)[0] in ("Q", "A", "B", "C", "D") for l in lines):
                    q_line, a_line, b_line, c_line, d_line = lines
                    q = q_line[2:].strip()
                    ca = a_line[2:].strip()
                    o1 = b_line[2:].strip()
                    o2 = c_line[2:].strip()
                    o3 = d_line[2:].strip()
                    if all([q, ca, o1, o2, o3]):
                        new_mcqs.append(
                            VideoMCQ(
                                video=video,
                                question=q,
                                correct_answer=ca,
                                option_1=o1,
                                option_2=o2,
                                option_3=o3,
                            )
                        )
            if new_mcqs:
                with transaction.atomic():
                    VideoMCQ.objects.filter(video=video).delete()
                    VideoMCQ.objects.bulk_create(new_mcqs)
                print(f"[Video] MCQs creados: {len(new_mcqs)} (objetivo {target_mcq_count})")
            else:
                print("[Video] No se parsearon MCQs válidos.")
        except Exception as e:
            print(f"[Video Error] MCQs: {e}")

        video.processing_status = "completed"
        video.save()
        print(f"[Video] Procesado OK {video.id}")
    except (TranscriptError, Exception) as e:
        print(f"[Video Fatal] {e}")
        video.processing_status = "failed"
        video.save()
