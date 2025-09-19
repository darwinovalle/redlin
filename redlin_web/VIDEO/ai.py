import os
import re
import time
import random
import json
from typing import List
from dotenv import load_dotenv
import google.generativeai as genai

from django.db import transaction
from .models import Video, VideoSummary, VideoMCQ, VideoCloze, VideoFeynman, VideoFeynmanAttempt
from .transcript_yt_dlp import fetch_transcript_yt_dlp, TranscriptError
from CORE.services.cloze_generator import VideoClozeGenerator

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
    language_line = "Idioma de salida: Español" if lang_label == "Spanish" else "Output language: English"
    return (
        "You are an expert learning assistant.\n"
        "TASK: Derive concise Feynman explanation prompts from the VIDEO TRANSCRIPT.\n"
        f"{cap_text}\n"
        "RULES:\n- Prompts <= 140 chars (hard cut 180).\n- Each targets a distinct concept/mechanism/process/relationship.\n"
        "- Provide 3-8 key_points per prompt (atomic, declarative).\n- Assign weight (1.0 default, up to 1.5).\n"
        "- No duplicates, no numbering, no quotes, no trivial surface-level prompts.\n"
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
            resp = generate_with_retry(pmt, max_attempts=2)
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
    rubric_lang_prefix = 'Devuelve la respuesta en Español.' if lang=='es' else 'Return the feedback in English.'
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
        resp = generate_with_retry(prompt, max_attempts=2)
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
    language_line = "Idioma de salida: Español" if lang_label == "Spanish" else "Output language: English"
    snippet = source_text[:16000]
    return (
        "You are an expert educational content generator.\n"
        "Generate as many high-quality fill-in-the-blank items (Cloze) as there are DISTINCT key concepts in the SOURCE TEXT.\n"
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
        f"{language_line}\n\nSOURCE TEXT (truncated):\n{snippet}"
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
            resp = generate_with_retry(p, max_attempts=2)
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
        target_mcq_count = _compute_target_mcq_count(full_text)

        # ---------------- Summary ----------------
        summary_text = ""
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

        # ---------------- MCQs ----------------
        mcq_prompt = f"""
You are an expert assessment designer specializing in educational content analysis.

TASK: Extract and convert ALL testable knowledge from the provided video/cc information into multiple-choice questions.

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
   - NO questions that begings like "According to the text", or "In the text", because this information is related to a video.

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

        # ---------------- Feynman Prompts ----------------
        try:
            fe_enabled = os.getenv("VIDEO_FEYNMAN_ENABLED", "1").lower() in {"1","true","yes","on"}
            if fe_enabled:
                print("[Video] Generating Feynman prompts...")
                regenerate = os.getenv("VIDEO_FEYNMAN_REGENERATE", "0").lower() in {"1","true","yes","on"}
                words = full_text.split()
                max_env = os.getenv("VIDEO_FEYNMAN_MAX", "").strip()
                unlimited = (max_env == "0") or (max_env == "")
                if unlimited:
                    est = None  # pasamos ilimitado
                else:
                    # Heurística: ~1 prompt cada 280 palabras, límites 6..60 antes de aplicar max
                    est_calc = max(6, min(60, len(words)//280 or 6))
                    if max_env.isdigit():
                        est_calc = min(est_calc, int(max_env))
                    est = est_calc
                f_created = generate_video_feynman(
                    video,
                    source_text=full_text,
                    lang_label=lang_label,
                    soft_cap=est,
                    regenerate=regenerate
                )
                goal_txt = 'unlimited' if est is None else est
                print(f"[Video] Feynman prompts creados: {len(f_created)} (objetivo {goal_txt})")
            else:
                print("[Video] Feynman generation disabled by VIDEO_FEYNMAN_ENABLED.")
        except Exception as e:
            print(f"[Video Error] Feynman: {e}")

        # -------------------------------------------------------------------
        # Cloze (AI-first con fallback local)
        # -------------------------------------------------------------------
        try:
            print("[Video] Generating Cloze items (AI-first)...")
            ai_enabled = os.getenv("AI_CLOZE_ENABLED", "false").lower() in {"1","true","yes","on"}
            words = full_text.split()
            words_per_item = int(os.getenv("AI_CLOZE_WORDS_PER_ITEM", "120"))
            unlimited = os.getenv("AI_CLOZE_MAX", "").strip() == "0"
            estimated = max(4, len(words)//words_per_item) if not unlimited else 0
            max_cap_env = os.getenv("AI_CLOZE_MAX", "")
            if max_cap_env.isdigit() and int(max_cap_env) > 0:
                estimated = min(estimated, int(max_cap_env))
            approx_items = estimated if estimated else 0  # 0 => ilimitado
            created_ai: list[VideoCloze] = []
            if ai_enabled:
                combined_source = (summary_text or "") + "\n\n" + full_text[:10000]
                created_ai = generate_ai_video_clozes(video, combined_source, lang_label, max_items=approx_items, words_per_item=words_per_item)
            if approx_items > 0 and len(created_ai) < max(1, approx_items // 2):
                print("[AI Video Cloze] Fallback local generation...")
                remaining = approx_items - len(created_ai)
                if remaining > 0:
                    vgen = VideoClozeGenerator(video, max_items=remaining)
                    local_items = vgen.generate()
                    print(f"[VideoCloze Fallback] Added {len(local_items)} local items.")
            print(f"[Video] Cloze total: {video.clozes.count()}")
        except Exception as e:
            print(f"[Video Error] Cloze gen: {e}")

        video.processing_status = "completed"
        video.save()
        print(f"[Video] Procesado OK {video.id}")
    except (TranscriptError, Exception) as e:
        print(f"[Video Fatal] {e}")
        video.processing_status = "failed"
        video.save()
