from .summary_service import generate_session_summary
from .mcq_service import generate_session_mcqs
from .cloze_service import generate_session_clozes
from .feynman_generation_service import generate_session_feynman

def process_classroom_session_text(class_session, text: str) -> None:
    """
    Mirroring the behavior of API/services/document_processing_service.py
    """
    try:
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise ValueError("Could not extract text from source")

        # English-only output (Spanish support deferred): the model may read
        # foreign-language source text, but every generated item is English.
        target_lang = "en"
        lang_label = "English"
        output_lang_instruction = "Produce the output in English. All generated text MUST be in English."

        # 1. Generate Summary
        summary_content = generate_session_summary(
            class_session, cleaned_text, lang_label, output_lang_instruction
        )

        # 2. Generate MCQs
        generate_session_mcqs(class_session, cleaned_text, lang_label)

        # 3. Generate Clozes
        generate_session_clozes(class_session, cleaned_text, lang_label, summary_content)

        # 4. Generate Feynman prompts
        generate_session_feynman(class_session, cleaned_text, summary_content, lang_label)

        print(f"Successfully processed ClassSession {class_session.id}.")
    except Exception as exc:
        print(f"[Fatal Error] Processing failed for ClassSession {class_session.id}: {exc}")
        raise exc