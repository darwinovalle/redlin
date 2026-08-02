import json
import os

from CORE.services.cloze_generator import ClozeGenerator

from API.models import Cloze, Document

from .processing_common import extract_json_block, generate_with_retry


def _ai_cloze_prompt(source_text: str, *, desired_count: int, words_per_item: int, lang_label: str) -> str:
    """Build prompt for AI Cloze generation (dynamic scaling)."""
    language_line = "Idioma de salida: Español" if lang_label == "Spanish" else "Output language: English"
    snippet = source_text[:16000]
    return (
        f"You are an expert educational content generator.\n"
        f"Generate as many high-quality fill-in-the-blank items (Cloze) as there are DISTINCT key concepts in the SOURCE TEXT.\n"
        f"Guideline: about 1 item per ~{words_per_item} words (estimated target ~= {desired_count}). Continue until additional items would be redundant.\n"
        "Prioritize: core definitions -> causal relations -> processes -> contrasts -> implications.\n"
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
    """Extract JSON from raw model output."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = "\n".join(part for part in parts if "clozes" in part or "{" in part)
        raw = raw.strip()

    obj = extract_json_block(raw, key_hint='"clozes"')
    if obj:
        try:
            return json.loads(obj)
        except Exception:
            return None
    return None


def generate_ai_clozes(
    document: Document,
    source_text: str,
    lang_label: str,
    *,
    max_items: int,
    words_per_item: int,
) -> list[Cloze]:
    """AI-first Cloze generation. Returns created Cloze rows."""
    debug = os.getenv("AI_CLOZE_DEBUG", "0").lower() in {"1", "true", "yes", "on"}
    base_prompt = _ai_cloze_prompt(
        source_text,
        desired_count=max_items if max_items > 0 else 1000,
        words_per_item=words_per_item,
        lang_label=lang_label,
    )
    attempts: list[tuple[str, str]] = [("primary", base_prompt)]
    strict_suffix = "\n\nIMPORTANT: Output ONLY the JSON object. Absolutely no prose, no explanation, no markdown fences."
    attempts.append(("strict", base_prompt + strict_suffix))

    payload = None
    raw_text = ""
    for label, prompt in attempts:
        try:
            resp = generate_with_retry(prompt, max_attempts=2, user_id=document.user_id)
        except Exception as exc:
            print(f"[AI Cloze] {label} generation failed: {exc}")
            continue

        raw_text = getattr(resp, "text", "") or ""
        if debug:
            print(f"[AI Cloze][{label}] Raw (first 300 chars): {raw_text[:300]!r}")
        payload = _clean_ai_json(raw_text)
        if payload and isinstance(payload, dict) and isinstance(payload.get("clozes"), list):
            break
        if debug:
            print(f"[AI Cloze][{label}] Could not parse JSON; will try next strategy.")
        payload = None

    if not payload:
        print("[AI Cloze] Invalid JSON structure after attempts")
        if debug and raw_text:
            print(f"[AI Cloze][debug] Last raw output tail: {raw_text[-300:]}")
        return []

    created: list[Cloze] = []
    seen_sentences: set[str] = set()
    lowered_source = source_text.lower()
    limit = None if max_items <= 0 else max_items
    items = payload["clozes"] if limit is None else payload["clozes"][:limit]

    for item in items:
        if not isinstance(item, dict):
            continue
        text_val = str(item.get("text") or "").strip()
        answer = str(item.get("answer") or "").strip()
        distractors = item.get("distractors") or []
        difficulty = str(item.get("difficulty") or "medium").lower()

        if text_val.count("____") != 1:
            continue
        if len(answer) < 2:
            continue
        if any(not isinstance(d, str) or len(d.strip()) < 2 for d in distractors):
            continue
        if len(distractors) != 3:
            continue
        if answer.lower() not in lowered_source:
            continue
        if any(d.lower() not in lowered_source for d in distractors):
            continue

        norm_sentence = text_val.lower()
        if norm_sentence in seen_sentences:
            continue
        seen_sentences.add(norm_sentence)
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = "medium"

        try:
            cloze = Cloze.objects.create(
                document=document,
                text_with_blank=text_val,
                answer=answer,
                context="",
                source_span=answer,
                options=distractors,
                meta={"source": "ai", "distractor_count": len(distractors)},
                difficulty=difficulty,
            )
            created.append(cloze)
        except Exception as exc:
            print(f"[AI Cloze] Persist error: {exc}")

    print(f"[AI Cloze] Created {len(created)} items (requested {max_items}).")
    return created


def generate_document_clozes(document: Document, text: str, summary_content: str, lang_label: str) -> None:
    """Generate document Cloze items with AI-first + local fallback strategy."""
    try:
        print("Generating Cloze items (AI-first)...")
        ai_enabled = os.getenv("AI_CLOZE_ENABLED", "true").lower() in {"1", "true", "yes", "on"}
        words = text.split()
        default_words_per_item = int(os.getenv("AI_CLOZE_WORDS_PER_ITEM", "120"))

        unlimited = os.getenv("AI_CLOZE_MAX", "").strip() == "0"
        estimated = max(4, len(words) // default_words_per_item) if not unlimited else 0
        max_cap_env = os.getenv("AI_CLOZE_MAX", "")
        if max_cap_env.isdigit() and int(max_cap_env) > 0:
            estimated = min(estimated, int(max_cap_env))
        approx_items = estimated if estimated else 0

        created_ai: list[Cloze] = []
        if ai_enabled:
            combined_source = (summary_content or "") + "\n\n" + text[:10000]
            created_ai = generate_ai_clozes(
                document,
                combined_source,
                lang_label,
                max_items=approx_items,
                words_per_item=default_words_per_item,
            )

        if approx_items > 0 and len(created_ai) < max(1, approx_items // 2):
            print("[AI Cloze] Fallback to local generator for remaining items...")
            remaining = approx_items - len(created_ai)
            if remaining > 0:
                cgen = ClozeGenerator(document, max_items=remaining)
                local_items = cgen.generate()
                print(f"[Cloze Fallback] Added {len(local_items)} local items.")

        total_clozes = document.clozes.count()
        print(f"Total Cloze items now: {total_clozes}.")
    except Exception as exc:
        print(f"[Error] Cloze AI/local generation failed: {exc}")
