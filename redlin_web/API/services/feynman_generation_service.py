import json
import os

from API.models import Document, Feynman

from .processing_common import extract_json_block, generate_with_retry


def _ai_feynman_prompt(source_text: str, *, lang_label: str, soft_cap: int | None) -> str:
    """Build prompt for generating Feynman prompts and key points."""
    snippet = source_text[:16000]
    cap_text = (
        f"Aim for at most ~{soft_cap} distinct prompts if the text supports that many; stop earlier when coverage is complete."
        if soft_cap and soft_cap > 0
        else "Generate as many distinct prompts as needed for full coverage; stop when concepts become redundant."
    )
    language_line = "Idioma de salida: Español" if lang_label == "Spanish" else "Output language: English"
    return (
        "You are an expert learning science assistant.\n"
        "TASK: Derive high-quality Feynman explanation prompts from the SOURCE TEXT.\n"
        "A 'Feynman prompt' is a short request that asks the learner to explain a concept, mechanism, process, principle or relationship in their own words.\n"
        f"{cap_text}\n"
        "RULES:\n"
        "- Each prompt MUST be concise (<= 140 characters preferred, NEVER exceed 180).\n"
        "- Avoid yes/no questions. Avoid trivial definitions already verbatim.\n"
        "- No numbering in the prompt text itself. No quotes.\n"
        "- Prompts must cover: core definitions, mechanisms, causal chains, processes, comparisons, implications, boundary conditions.\n"
        "- Skip purely bibliographic or formatting content.\n"
        "- Do NOT duplicate coverage; each prompt should target a distinct conceptual unit.\n"
        "- For each prompt produce 3-8 key points the ideal explanation SHOULD include.\n"
        "- Key points must be atomic, declarative, and derived from the source; no hallucinations.\n"
        "- Assign a weight (1.0 default) but allow emphasizing especially central points up to 1.5.\n"
        "- Keep JSON minimal: no trailing commas, no markdown fences, no commentary.\n"
        "OUTPUT STRICT JSON ONLY with schema:\n"
        "{\n  \"items\": [\n    {\n      \"prompt\": \"Explain the Krebs cycle role in energy production\",\n      \"key_points\": [\n        {\"point\": \"Occurs in mitochondria matrix\", \"weight\": 1.0},\n        {\"point\": \"Generates NADH and FADH2 for ETC\", \"weight\": 1.0},\n        {\"point\": \"Oxidizes acetyl-CoA to CO2\", \"weight\": 1.2}\n      ]\n    }\n  ]\n}\n"
        "VALIDATION:\n"
        "- 'items' array present.\n"
        "- Each item has prompt (string) + key_points (list 3..8) each with point + weight (float).\n"
        "- No duplicate prompt texts (case-insensitive).\n"
        f"{language_line}\n\nSOURCE TEXT (truncated):\n{snippet}"
    )


def _clean_ai_feynman_json(raw: str) -> dict | None:
    """Extract JSON payload for feynman generation."""
    raw = raw.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "items" in data:
            return data
    except Exception:
        pass

    if raw.startswith("```"):
        segments = raw.split("```")
        raw = "\n".join(segment for segment in segments if "items" in segment or "{" in segment)
        raw = raw.strip()

    obj = extract_json_block(raw, key_hint='"items"')
    if obj:
        try:
            data = json.loads(obj)
            if isinstance(data, dict) and "items" in data:
                return data
        except Exception:
            return None
    return None


def generate_ai_feynman(
    document: Document,
    source_text: str,
    lang_label: str,
    *,
    soft_cap: int | None,
    regenerate: bool,
) -> list[Feynman]:
    """Generate and persist Feynman prompts for a document."""
    existing_count = document.feynmans.count()
    if existing_count > 0 and not regenerate:
        print(f"[Feynman] Existing items ({existing_count}) present; skipping generation (regenerate disabled).")
        return []

    internal_max = soft_cap if soft_cap and soft_cap > 0 else 80
    base_prompt = _ai_feynman_prompt(source_text, lang_label=lang_label, soft_cap=internal_max)
    attempts: list[tuple[str, str]] = [("primary", base_prompt)]
    attempts.append(("strict", base_prompt + "\nIMPORTANT: Output ONLY the JSON object. Absolutely no prose."))

    payload = None
    for label, prompt in attempts:
        try:
            resp = generate_with_retry(prompt, max_attempts=2, user_id=document.user_id)
        except Exception as exc:
            print(f"[Feynman] {label} generation failed: {exc}")
            continue

        raw_text = getattr(resp, "text", "") or ""
        payload = _clean_ai_feynman_json(raw_text)
        if payload and isinstance(payload.get("items"), list):
            break
        payload = None

    if not payload:
        print("[Feynman] Invalid JSON structure after attempts")
        return []

    created: list[Feynman] = []
    seen_prompts: set[str] = set()
    limit = None if not internal_max else internal_max
    items_iter = payload["items"] if limit is None else payload["items"][:limit]

    for item in items_iter:
        if not isinstance(item, dict):
            continue
        prompt_text = str(item.get("prompt") or "").strip()
        if not prompt_text:
            continue

        norm = prompt_text.lower()
        if norm in seen_prompts:
            continue
        seen_prompts.add(norm)

        if len(prompt_text) > 180:
            prompt_text = prompt_text[:180].rstrip()
        if len(prompt_text) > 140:
            prompt_text = prompt_text[:140].rstrip()

        raw_points = item.get("key_points") or []
        if not isinstance(raw_points, list):
            continue

        structured_points = []
        for kp in raw_points:
            if isinstance(kp, dict):
                point = str(kp.get("point") or "").strip()
                if not point:
                    continue
                try:
                    weight = float(kp.get("weight", 1.0))
                except Exception:
                    weight = 1.0
                if weight <= 0:
                    weight = 1.0
                if weight > 1.5:
                    weight = 1.5
                structured_points.append(
                    {"id": len(structured_points) + 1, "point": point, "weight": round(weight, 2)}
                )
            elif isinstance(kp, str):
                point = kp.strip()
                if point:
                    structured_points.append({"id": len(structured_points) + 1, "point": point, "weight": 1.0})

        if len(structured_points) < 2:
            continue

        try:
            f_obj = Feynman.objects.create(
                document=document,
                prompt=prompt_text,
                key_points=structured_points,
                reference=None,
            )
            created.append(f_obj)
        except Exception as exc:
            try:
                snippet = json.dumps(item)[:200]
            except Exception:
                snippet = repr(item)[:200]
            print(f"[Feynman] Persist error: {exc} | Raw item: {snippet}")

    print(f"[Feynman] Created {len(created)} items (requested soft cap {soft_cap}).")
    return created


def generate_document_feynman(document: Document, text: str, summary_content: str, lang_label: str) -> int:
    """Generate feynman prompts for a document and return created count."""
    try:
        print("Generating Feynman prompts...")
        combined_source = (summary_content or "") + "\n\n" + text[:12000]
        cap_env = os.getenv("AI_FEYNMAN_MAX", "").strip()
        soft_cap = int(cap_env) if cap_env.isdigit() and int(cap_env) > 0 else None
        regenerate = os.getenv("AI_FEYNMAN_REGENERATE", "0").lower() in {"1", "true", "yes", "on"}

        created = generate_ai_feynman(
            document,
            combined_source,
            lang_label,
            soft_cap=soft_cap,
            regenerate=regenerate,
        )
        print(f"Feynman prompts total now: {document.feynmans.count()} (new {len(created)}).")
        return len(created)
    except Exception as exc:
        print(f"[Error] Feynman generation failed: {exc}")
        return 0
