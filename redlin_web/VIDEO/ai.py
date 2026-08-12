import os
import re
import time
import json
from typing import List

from django.db import transaction
from .models import Video, VideoSummary, VideoMCQ, VideoCloze, VideoFeynman, VideoFeynmanAttempt
from .transcript_yt_dlp import fetch_transcript_yt_dlp, TranscriptError
from CORE.services.cloze_generator import VideoClozeGenerator
from CLASSROOM.services.stt_service import transcribe_audio_file, STTServiceError
# Shared per-user LLM dispatch (provider resolution, retry, Ollama fallback).
from API.services.processing_common import detect_language, extract_json_block, generate_with_retry

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


def _split_text(text: str, chunk_chars: int = 3500) -> list[str]:
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


def _parse_mcq_blocks(raw: str) -> list[dict]:
    """Parse Q:/A:/B:/C:/D: blocks from a video MCQ response (lenient — skips malformed)."""
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

# ---------------------------------------------------------------------------
# Video Feynman generation & evaluation
# ---------------------------------------------------------------------------
def _video_feynman_prompt(source_text: str, *, lang_label: str, soft_cap: int | None) -> str:
    use_full = os.getenv("VIDEO_FEYNMAN_FULL", "0").lower() in {"1","true","yes","on"}
    # If unlimited/full requested, avoid truncation (model may still truncate internally)
    if use_full or not soft_cap or soft_cap <= 0:
        snippet = source_text
    else:
        snippet = source_text[:16000]
    cap_text = (
        f"Aim for at most ~{soft_cap} prompts if justified; stop early when coverage complete." if soft_cap and soft_cap>0
        else "Generate exhaustive distinct Feynman explanation prompts covering ALL non-trivial concepts; stop ONLY when further prompts would be redundant."
    )
    # English-only output (Spanish support deferred).
    language_line = "Output language: English. All generated text MUST be in English."
    return (
        "You are an expert learning assistant.\n"
        "TASK: Derive concise Feynman explanation prompts from the VIDEO TRANSCRIPT.\n"
        f"{cap_text}\n"
        "RULES:\n- Prompts <= 140 chars (hard cut 180).\n- Each targets a distinct concept/mechanism/process/relationship.\n"
        "- Provide 3-8 key_points per prompt (atomic, declarative).\n- Assign weight (1.0 default, up to 1.5).\n"
        "\n- No duplicates, no numbering, no quotes, no trivial surface-level prompts.\n"
        "- Do NOT add a source preface (no \"In the video\", \"In the text\", \"In the paragraph\"); phrase each prompt as a direct concept prompt.\n"
        "OUTPUT STRICT JSON ONLY:\n{\n  \"items\": [ { \"prompt\": \"...\", \"key_points\": [ {\"point\": \"...\", \"weight\": 1.0} ] } ]\n}\n"
        f"{language_line}\n\nVIDEO TRANSCRIPT (truncated):\n{snippet}"
    )

def _clean_video_feynman_json(raw: str):
    raw = raw.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and 'items' in data:
            return data
    except Exception:
        pass
    if raw.startswith('```'):
        parts = raw.split('```')
        raw = '\n'.join(p for p in parts if 'items' in p or '{' in p)
    start = raw.find('{')
    while start != -1:
        depth = 0
        for i,ch in enumerate(raw[start:], start=start):
            if ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    block = raw[start:i+1]
                    if 'items' in block:
                        try:
                            data = json.loads(block)
                            if 'items' in data:
                                return data
                        except Exception:
                            pass
                    break
        start = raw.find('{', start+1)
    return None

def generate_video_feynman(video: Video, source_text: str, lang_label: str, *, soft_cap: int | None, regenerate: bool=False):
    existing = video.feynmans.count()
    if existing>0 and not regenerate:
        print(f"[VideoFeynman] Existing {existing}; skip (regenerate off)")
        return []
    # If soft_cap <=0 or None => unlimited (subject to payload size)
    unlimited = (soft_cap is None) or (isinstance(soft_cap, int) and soft_cap <= 0)
    safe_cap = soft_cap if (soft_cap and soft_cap>0) else (100000 if unlimited else 60)
    base = _video_feynman_prompt(source_text, lang_label=lang_label, soft_cap=safe_cap)
    attempts=[('primary', base), ('strict', base+"\nIMPORTANT: JSON only.")]
    payload=None
    for label,pmt in attempts:
        try:
            resp = generate_with_retry(pmt, max_attempts=2, user_id=video.user_id)
            raw = getattr(resp,'text','') or ''
            debug = os.getenv("VIDEO_FEYNMAN_DEBUG","0").lower() in {"1","true","yes","on"}
            if debug:
                print(f"[VideoFeynman][{label}] Raw (first 280 chars): {raw[:280]!r}")
            payload=_clean_video_feynman_json(raw)
            if payload: break
        except Exception as e:
            print(f"[VideoFeynman] {label} fail: {e}")
    if not payload:
        if os.getenv("VIDEO_FEYNMAN_DEBUG","0").lower() in {"1","true","yes","on"}:
            print("[VideoFeynman][debug] Could not parse JSON after attempts.")
    if not payload:
        print('[VideoFeynman] Could not parse JSON.')
        return []
    created=[]
    seen=set()
    items_iter = payload.get('items', [])
    # Only slice if not unlimited
    if not unlimited:
        items_iter = items_iter[:safe_cap]
    for item in items_iter:
        if not isinstance(item, dict):
            continue
        prompt = str(item.get('prompt') or '').strip()
        if not prompt:
            continue
        norm=prompt.lower()
        if norm in seen:
            continue
        seen.add(norm)
        if len(prompt)>180: prompt=prompt[:180].rstrip()
        if len(prompt)>140: prompt=prompt[:140].rstrip()
        raw_points=item.get('key_points') or []
        if not isinstance(raw_points,list):
            continue
        points=[]
        for kp in raw_points:
            if isinstance(kp, dict):
                pt=str(kp.get('point') or '').strip()
                if not pt: continue
                try: wt=float(kp.get('weight',1.0))
                except Exception: wt=1.0
                wt=1.0 if wt<=0 else (1.5 if wt>1.5 else wt)
                points.append({'id': len(points)+1, 'point': pt, 'weight': round(wt,2)})
            elif isinstance(kp,str):
                pt=kp.strip()
                if pt:
                    points.append({'id': len(points)+1, 'point': pt, 'weight':1.0})
        if len(points)<2:
            continue
        try:
            obj=VideoFeynman.objects.create(video=video, prompt=prompt, key_points=points, reference=None)
            created.append(obj)
        except Exception as e:
            print(f"[VideoFeynman] Persist error: {e}")
    print(f"[VideoFeynman] Created {len(created)} prompts.")
    return created

def evaluate_video_feynman_attempt(f_obj: VideoFeynman, answer: str, user) -> VideoFeynmanAttempt:
    attempt = VideoFeynmanAttempt.objects.create(
        video=f_obj.video,
        feynman=f_obj,
        user=user,
        answer_text=' '.join(answer.strip().split())
    )
    lang = detect_language(f_obj.prompt + ' ' + ' '.join(k['point'] for k in f_obj.key_points))
    # English-only feedback.
    rubric_lang_prefix = 'Return the feedback in English.'
    prompt = f"""
You are an expert tutor applying a strict explanation rubric.
{rubric_lang_prefix}
SCORING 1-100 integer. TIERS: <60 deficiente | 60-79 aceptable | 80-100 sobresaliente.
RUBRIC: coverage(40), accuracy(25), clarity(15), simplicity(10), -misconceptions(10), -hallucination(10).
KEY POINTS: {json.dumps(f_obj.key_points, ensure_ascii=False)}
ANSWER: {attempt.answer_text}
STRICT JSON ONLY:
{{"score":88,"coverage":0.75,"accuracy":0.8,"clarity":0.9,"simplicity":0.85,"misconceptions_penalty":0.0,"hallucination_penalty":0.0,"matched_key_points":[1,2],"missing_key_points":[3],"feedback":"Short feedback."}}
"""
    try:
        debug = os.getenv("VIDEO_FEYNMAN_EVAL_DEBUG","0").lower() in {"1","true","yes","on"}
        resp = generate_with_retry(prompt, max_attempts=2, user_id=user.id)
        raw = getattr(resp,'text','') or ''
        if debug:
            print(f"[VideoFeynmanEval][raw first 300] {raw[:300]!r}")
        data = None
        # 1) Direct load
        try:
            data = json.loads(raw.strip())
        except Exception:
            pass
        # 2) Inside fenced code blocks
        if data is None and raw.startswith('```'):
            parts = raw.split('```')
            for p in parts:
                p = p.strip()
                if not p:
                    continue
                if p.startswith('{') and 'score' in p:
                    try:
                        data = json.loads(p)
                        break
                    except Exception:
                        continue
        # 3) Find first JSON object containing "score"
        if data is None:
            start_positions = [m.start() for m in re.finditer(r'\{', raw)]
            for s in start_positions:
                segment = raw[s:]
                # naive bracket balance
                depth = 0
                for i,ch in enumerate(segment):
                    if ch == '{': depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            candidate = segment[:i+1]
                            if 'score' in candidate:
                                try:
                                    data = json.loads(candidate)
                                    break
                                except Exception:
                                    pass
                            break
                if data is not None:
                    break
        if data is None or 'score' not in data:
            attempt.breakdown = {'raw': raw, 'parse_error': True}
            attempt.save()
            if debug:
                print('[VideoFeynmanEval] Failed to parse JSON for evaluation.')
            return attempt
        # Normalize & clamp
        attempt.score = int(max(1, min(100, data.get('score', 1))))
        attempt.breakdown = data
        matched = data.get('matched_key_points') or []
        total = len(f_obj.key_points)
        if total > 0 and isinstance(matched, list):
            attempt.key_points_coverage = max(0.0, min(1.0, len(matched)/total))
        attempt.save()
    except Exception as e:
        print(f"[VideoFeynmanEval] Error: {e}")
        attempt.breakdown = {'error': str(e)}
        attempt.save()
    return attempt

# ---------------------------------------------------------------------------
# AI Cloze helpers (paridad con documentos)
# ---------------------------------------------------------------------------
def _extract_json_block(text: str, key_hint: str) -> str | None:
    starts = [m.start() for m in re.finditer(r'\{', text)]
    for s in starts:
        if key_hint not in text[s:]:
            continue
        depth = 0
        for i, ch in enumerate(text[s:], start=s):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    cand = text[s:i+1].strip()
                    if key_hint in cand:
                        return cand
                    break
    return None

def _clean_ai_json(raw: str) -> dict | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        pass
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = "\n".join(p for p in parts if 'clozes' in p or '{' in p).strip()
    block = _extract_json_block(raw, '"clozes"')
    if block:
        try:
            return json.loads(block)
        except Exception:
            return None
    return None

def _ai_video_cloze_prompt(source_text: str, *, desired_count: int, words_per_item: int, lang_label: str) -> str:
    # English-only output.
    language_line = "Output language: English. All generated text MUST be in English."
    snippet = source_text[:16000]
    return (
        "You are an expert educational content generator.\n"
        "Generate as many high-quality fill-in-the-blank items (Cloze) as there are DISTINCT key concepts in the VIDEO TRANSCRIPT.\n"
        f"Guideline: about 1 item per ~{words_per_item} words (estimated target ≈ {desired_count}). Continue until additional items would be redundant.\n"
        "Prioritize: core definitions → causal relations → processes → contrasts → implications.\n"
        "Skip trivial filler (articles, pronouns, purely structural verbs, generic words like 'thing', 'people').\n"
        "Each answer must be pedagogically valuable (concept, entity, process, mechanism, quantitative fact).\n"
        "Avoid making blanks out of stopwords, common verbs (be/have/do), or numbers unless they are key data points.\n\n"
        "REQUIREMENTS:\n"
        "- Each item has exactly one blank represented by the four underscores token: ____\n"
        "- Sentence must be concise, pedagogically meaningful (avoid over-long verbatim copying).\n"
        "- Sentences should read naturally and self-contained; do NOT start them with \"In the video\", \"In the text\", or \"In the paragraph\".\n"
        "- Blank hides a key term/concept present EXACTLY in the video.\n"
        "- All 3 distractors also appear in the video and share semantic / POS class with answer.\n"
        "- No duplicate answers or duplicate sentences.\n"
        "- Difficulty: easy | medium | hard.\n"
        "- Provide a MIX of difficulties; harder = abstraction, multi-step reasoning, rarity.\n"
        "- Stop BEFORE producing near-duplicates or overly narrow paraphrases.\n\n"
        "OUTPUT STRICT JSON ONLY (no markdown fences) with schema:\n"
        "{\n  \"clozes\": [\n     {\n       \"text\": \"La célula contiene ____ que protege el material genético.\",\n       \"answer\": \"núcleo\",\n       \"distractors\": [\"citoplasma\",\"membrana\",\"ribosoma\"],\n       \"difficulty\": \"medium\"\n     }\n  ]\n}\n\n"
        "VALIDATION RULES:\n"
        "- 'text' has exactly one '____'.\n"
        "- answer + distractors all appear in the video transcript.\n"
        "- Exactly 3 distractors.\n"
        "- Answer is NOT a stopword / trivial function word.\n"
        "- No trailing commas, no extra keys, no wrapper prose.\n\n"
        f"{language_line}\n\nVIDEO TRANSCRIPT (truncated):\n{snippet}"
    )

def generate_ai_video_clozes(video: Video, source_text: str, lang_label: str, *, max_items: int, words_per_item: int) -> list[VideoCloze]:
    debug = os.getenv("AI_CLOZE_DEBUG", "0").lower() in {"1","true","yes","on"}
    desired = max_items if max_items > 0 else 1000
    prompt = _ai_video_cloze_prompt(source_text, desired_count=desired, words_per_item=words_per_item, lang_label=lang_label)
    attempts = [
        ("primary", prompt),
        ("strict", prompt + "\n\nIMPORTANT: Output ONLY the JSON object. Absolutely no prose, no fences."),
    ]
    payload = None
    last_raw = ""
    for label, p in attempts:
        try:
            resp = generate_with_retry(p, max_attempts=2, user_id=video.user_id)
        except Exception as e:
            print(f"[AI Video Cloze] {label} fail: {e}")
            continue
        last_raw = getattr(resp, 'text', '') or ''
        if debug:
            print(f"[AI Video Cloze][{label}] Raw first 250: {last_raw[:250]!r}")
        payload = _clean_ai_json(last_raw)
        if payload and isinstance(payload, dict) and isinstance(payload.get('clozes'), list):
            break
        payload = None
    if not payload:
        print("[AI Video Cloze] Invalid JSON; falling back")
        if debug and last_raw:
            print(f"[AI Video Cloze][debug] tail: {last_raw[-250:]}")
        return []
    created: list[VideoCloze] = []
    seen: set[str] = set()
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
        if len(distractors) != 3 or any(not isinstance(d, str) or len(d.strip()) < 2 for d in distractors):
            continue
        if answer.lower() not in lowered_source:
            continue
        if any(d.lower() not in lowered_source for d in distractors):
            continue
        norm = text_val.lower()
        if norm in seen:
            continue
        seen.add(norm)
        if difficulty not in {"easy","medium","hard"}:
            difficulty = "medium"
        try:
            vc = VideoCloze.objects.create(
                video=video,
                text_with_blank=text_val,
                answer=answer,
                context='',
                source_span=answer,
                options=distractors,
                meta={"source":"ai","distractor_count": len(distractors)},
                difficulty=difficulty,
            )
            created.append(vc)
        except Exception as e:
            print(f"[AI Video Cloze] persist err: {e}")
    print(f"[AI Video Cloze] Created {len(created)} (requested {max_items}).")
    return created



def _generate_video_content(video, full_text: str, lang_label: str):
    """Generate Summary + MCQs + Feynman + Clozes for a Video from its transcript.

    Shared by the YouTube path (process_video) and the uploaded-MP4 path
    (process_video_file). Bounded/chunked so long transcripts (20-60min) stay
    within output-token limits and never break JSON parsing.
    """
    summary_text = ""
    # ---------------- Summary ----------------
    try:
        summary_heading_note = "Produce the output in English. All generated text MUST be in English."
        target_mcq_count = _compute_target_mcq_count(full_text)
        summary_prompt = f"""
You are an expert academic summarizer. {summary_heading_note}

GOAL
Produce a high-signal, chapter/section-structured summary that captures the core intellectual substance of the source.

OUTPUT FORMAT (Pure Markdown only)
- First line MUST be exactly an H1 with the video title.
- After the title, output the structured summary only. No preamble, no meta text.
- Use section headings as H2 (##), each starting with ONE emoji + space + concise heading.
- Under each heading, use dense bullets ("- ") OR tight mini paragraphs.
- Final section must be:
  ## ⭐ Key Takeaways
  - 5-12 distilled bullets (no redundancy).

CONTENT RULES (Absolute)
- Omit front matter: copyright notices, ISBN, disclaimers, dedications, acknowledgments.
- Preserve the source logic; no hallucinations; only facts supported by the transcript.
- Output language: {lang_label}
- If negligible substance after filtering, output:  (No substantive content found in provided excerpt.)

VIDEO TRANSCRIPT (for analysis; paraphrase in output)
{full_text[:24000]}
"""
        summary_resp = generate_with_retry(summary_prompt, user_id=video.user_id)
        summary_text = summary_resp.text
        VideoSummary.objects.update_or_create(video=video, defaults={"content": summary_text})
    except Exception as e:
        print(f"[Video Error] Summary: {e}")

    # ---------------- MCQs (chunked + bounded) ----------------
    try:
        mcq_prompt_template = """
You are an expert assessment designer specializing in educational content analysis.

TASK: Create up to {limit} multiple-choice questions based ONLY on the provided video transcript.
Language: {lang_label}

CRITICAL REQUIREMENTS:
1. Focus on the MOST IMPORTANT concepts, facts, or principles in the text.
2. The correct answer MUST be 100% verifiable from the transcript.
3. Distractors must be plausible but definitively wrong.
4. No "All/None of the above", no negatively-phrased questions.
5. Each question must be self-contained.

OUTPUT FORMAT — RETURN ONLY A VALID JSON ARRAY. NO PREAMBLE. NO MARKDOWN FENCES.
Each item: {{"question": "...", "correct_answer": "...", "options": ["...","...","...","..."]}}

TRANSCRIPT CHUNK:
{chunk}
"""
        seen = set()
        created = []
        target = max(5, min(_compute_target_mcq_count(full_text), 25))
        chunks = _split_text(full_text)
        for chunk_index, c in enumerate(chunks):
            if len(created) >= target:
                break
            prompt = mcq_prompt_template.format(limit=8, lang_label=lang_label, chunk=c)
            try:
                resp = generate_with_retry(prompt, user_id=video.user_id)
            except Exception:
                continue
            for item in _parse_mcq_blocks(resp.text):
                q = (item.get("question") or "").casefold()
                if not q or q in seen:
                    continue
                seen.add(q)
                created.append(VideoMCQ(video=video, **item))
                if len(created) >= target:
                    break
        if created:
            with transaction.atomic():
                VideoMCQ.objects.filter(video=video).delete()
                VideoMCQ.objects.bulk_create(created)
    except Exception as e:
        print(f"[Video Error] MCQs: {e}")

    # ---------------- Feynman Prompts ----------------
    try:
        if os.getenv("VIDEO_FEYNMAN_ENABLED", "1").lower() in {"1", "true", "yes", "on"}:
            words = full_text.split()
            max_env = os.getenv("VIDEO_FEYNMAN_MAX", "").strip()
            unlimited = (max_env == "0") or (max_env == "")
            est = None if unlimited else max(6, min(len(words) // 280, 60))
            generate_video_feynman(video, full_text, lang_label, soft_cap=est, regenerate=False)
    except Exception as e:
        print(f"[Video Error] Feynman: {e}")

    # ---------------- Clozes ----------------
    try:
        approx_items = max(5, min(len(full_text.split()) // 180, 20))
        generate_ai_video_clozes(video, full_text, lang_label, max_items=approx_items, words_per_item=5)
    except Exception as e:
        print(f"[Video Error] Clozes: {e}")

    video.processing_status = "completed"
    video.save()
    print(f"[Video] Procesado OK {video.id}")

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

        # English-only output (Spanish support deferred): the model may read foreign
        # transcripts but every generated item is English.
        _generate_video_content(video, full_text, lang_label="English")
    except (TranscriptError, Exception) as e:
        print(f"[Video Fatal] {e}")
        video.processing_status = "failed"
        video.save()


def process_video_file(video_id_db: int, language_hint: str = "en"):
    """Transcribe an uploaded video file (MP4) with Whisper and generate the
    same Summary / MCQs / Clozes / Feynman content as YouTube videos.
    """
    video = Video.objects.get(id=video_id_db)
    if video.processing_status == 'completed':
        print(f"[Video] {video.id} ya procesado.")
        return
    video.processing_status = 'processing'
    video.save()
    try:
        if not video.audio_file:
            raise ValueError("No audio file uploaded for this video")
        print(f"[Video] Transcribiendo archivo (whisper) {video.audio_file.name}")
        result = transcribe_audio_file(video.audio_file.path, language_hint=language_hint)
        full_text = "\n".join(seg.text for seg in result.segments)
        video.transcript_text = full_text
        video.snippet_count = len(result.segments)
        if not video.title:
            video.title = (video.audio_file.name or f"Video {video.id}")[:255]
        video.save()

        if not full_text.strip():
            raise ValueError("Transcript vacío")

        # English-only output (Spanish support deferred).
        _generate_video_content(video, full_text, lang_label="English")
    except (TranscriptError, STTServiceError, Exception) as e:
        print(f"[Video File Fatal] {e}")
        video.processing_status = "failed"
        video.save()
