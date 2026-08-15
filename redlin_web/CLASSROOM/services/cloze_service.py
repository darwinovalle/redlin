import json
from API.services.processing_common import generate_with_retry, extract_json_block
from CLASSROOM.models import ClassSession, ClassSessionCloze

def generate_session_clozes(class_session: ClassSession, source_text: str, lang_label: str, summary_content: str, max_items: int = 10) -> int:
    # English-only output (Spanish support deferred). The model may read source
    # text in any language, but every generated item must be English.
    language_line = "Output language: English. All generated text (sentences, answers, distractors) MUST be in English."
    snippet = source_text[:16000]
    prompt = (
        f"You are an expert educational content generator.\n"
        f"Generate high-quality fill-in-the-blank items (Cloze) for the SOURCE TEXT.\n"
        f"Guideline: target ~= {max_items} items.\n"
        "Prioritize: core definitions -> causal relations -> processes -> contrasts -> implications.\n"
        "OUTPUT STRICT JSON ONLY with schema:\n"
        "{\n  \"clozes\": [\n     {\n       \"text\": \"...\",\n       \"answer\": \"...\",\n       \"distractors\": [\"...\", \"...\", \"...\"],\n \"difficulty\": \"medium\"\n     }\n  ]\n}\n"
        f"{language_line}\n\nSOURCE TEXT (truncated):\n{snippet}"
    )

    try:
        response = generate_with_retry(prompt, max_attempts=2, user_id=class_session.user_id)
        payload = extract_json_block(response.text, key_hint='"clozes"')
        if not payload: return 0

        data = json.loads(payload)
        items = data.get("clozes", [])
        created_count = 0
        for item in items:
            ClassSessionCloze.objects.create(
                class_session=class_session,
                text_with_blank=item.get("text", ""),
                answer=item.get("answer", ""),
                options=item.get("distractors", []),
                difficulty=item.get("difficulty", "medium"),
                context="",               
                source_span=item.get("answer", ""),
            )                                
            created_count += 1                                                                                                                              
        return created_count                                                                                                                                
    except Exception as exc:                                                                                                                                
        print(f"[Error] ClassSession Cloze generation failed: {exc}")                                                                                       
        return 0