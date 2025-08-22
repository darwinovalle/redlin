import os
import re
import time
import random
from typing import List
from dotenv import load_dotenv
import google.generativeai as genai

from django.db import transaction
from .models import Video, VideoSummary, VideoMCQ
from .transcript import fetch_transcript, TranscriptError

load_dotenv()
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
_model = genai.GenerativeModel("gemini-1.5-flash")

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
        print(f"[Video] Obteniendo transcript ({video.url})")
        data = fetch_transcript(video.url, languages=languages)
        snippets = data["snippets"]
        video.video_id = data["video_id"]
        video.snippet_count = len(snippets)
        full_text = " ".join(s["text"] for s in snippets if s.get("text"))
        video.transcript_text = full_text
        video.save()

        if not full_text.strip():
            raise ValueError("Transcript vacío")

        # Detectar idioma dominante
        dominant = detect_language(full_text)
        # Reglas solicitadas
        if dominant in ("en","es"):
            target_lang = dominant
        else:
            target_lang = "en"  # otros idiomas -> siempre inglés

        lang_label = "English" if target_lang == "en" else "Spanish"
        summary_heading_note = ("Produce la salida en Español." if target_lang == "es"
                                else "Produce the output in English.")
        timestamp_ref = _build_timestamp_reference(snippets)
        target_mcq_count = _compute_target_mcq_count(full_text)

        # Summary prompt mejorado
        summary_prompt = f"""
You are an expert educator. {summary_heading_note}
Create an engaging, well-structured video summary with:
1. A clear title (include a relevant emoji).
2. Thematic sections. Each section title MUST start with an emoji (distinct per section).
3. Bullet points or short paragraphs easy to scan.
4. Each factual statement or concept MUST include at least one timestamp in [mm:ss] format referencing the provided transcript timestamps.
5. A 'Key Takeaways' section with concise bullets (each bullet with a timestamp).
6. A 'Timeline Highlights' section listing major moments chronologically (timestamp first, then short description).
7. Avoid hallucinations; only use provided transcript content.
8. Keep language natural and accessible.

Language to use: {lang_label}

TRANSCRIPT TIMESTAMP REFERENCE (do not rewrite this verbatim, only cite needed timestamps):
{timestamp_ref}

RAW TRANSCRIPT (for context):
{full_text}
"""
        try:
            summary_resp = generate_with_retry(summary_prompt)
            summary_text = summary_resp.text
            VideoSummary.objects.update_or_create(
                video=video,
                defaults={'content': summary_text}
            )
        except Exception as e:
            print(f"[Video Error] Summary: {e}")

        # MCQ prompt mejorado
        mcq_prompt = f"""
You are an assessment designer. Generate EXACTLY {target_mcq_count} high-quality multiple choice questions
covering ALL the key concepts of the video transcript (concept coverage is more important than quantity).
Language: {lang_label}. If the transcript language is neither English nor Spanish you MUST still write MCQs in English.
Rules:
- Difficulty varied (easy, medium, a few challenging).
- No trivia about greetings or filler; focus on meaningful concepts.
- Each distractor must be plausible but clearly incorrect.
- Do NOT repeat questions or answers.
- Avoid options like "All of the above" or "None of the above".
- Format EXACTLY per question block:

Q: <question>
A: <correct answer>
B: <distractor 1>
C: <distractor 2>
D: <distractor 3>

- Separate blocks with ONE blank line.
- No extra commentary.

Reference timestamps when helpful by appending (mm:ss) within the question ONLY if it aids clarity.

TRANSCRIPT TIMESTAMP REFERENCE:
{timestamp_ref}

RAW TRANSCRIPT (for context):
{full_text}
"""
        try:
            mcq_resp = generate_with_retry(mcq_prompt)
            raw = mcq_resp.text.strip()
            blocks = raw.split("\n\n")
            new_mcqs = []
            for block in blocks:
                lines = [l for l in block.strip().split("\n") if l.strip()]
                if len(lines) == 5 and all(l.split(":",1)[0] in ("Q","A","B","C","D") for l in lines):
                    q_line,a_line,b_line,c_line,d_line = lines
                    q = q_line[2:].strip()
                    ca = a_line[2:].strip()
                    o1 = b_line[2:].strip()
                    o2 = c_line[2:].strip()
                    o3 = d_line[2:].strip()
                    if all([q,ca,o1,o2,o3]):
                        new_mcqs.append(VideoMCQ(
                            video=video,
                            question=q,
                            correct_answer=ca,
                            option_1=o1,
                            option_2=o2,
                            option_3=o3
                        ))
            if new_mcqs:
                with transaction.atomic():
                    VideoMCQ.objects.filter(video=video).delete()
                    VideoMCQ.objects.bulk_create(new_mcqs)
                print(f"[Video] MCQs creados: {len(new_mcqs)} (objetivo {target_mcq_count})")
            else:
                print("[Video] No se parsearon MCQs válidos.")
        except Exception as e:
            print(f"[Video Error] MCQs: {e}")

        video.processing_status = 'completed'
        video.save()
        print(f"[Video] Procesado OK {video.id}")

    except (TranscriptError, Exception) as e:
        print(f"[Video Fatal] {e}")
        video.processing_status = 'failed'
        video.save()
