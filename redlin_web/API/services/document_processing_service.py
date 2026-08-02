from PyPDF2 import PdfReader

from API.models import Document

from .cloze_generation_service import generate_document_clozes
from .feynman_generation_service import generate_document_feynman
# from .flashcard_generation_service import generate_flashcards
from .mcq_generation_service import generate_mcqs
from .processing_common import detect_language
from .summary_generation_service import generate_summary


def process_document_text(document_id: int, text: str) -> None:
    """Run the generation pipeline starting from already-available text."""
    document = Document.objects.get(id=document_id)
    if document.processing_status == "completed":
        print(f"Document {document_id} already processed. Skipping.")
        return

    document.processing_status = "processing"
    document.save(update_fields=["processing_status"])
    print(f"Processing document text: {document.title} (ID: {document_id})")

    try:
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise ValueError("Could not extract text from source")

        dominant = detect_language(cleaned_text)
        target_lang = dominant if dominant in {"en", "es"} else "en"
        lang_label = "English" if target_lang == "en" else "Spanish"
        output_lang_instruction = (
            "Produce la salida en Espanol." if target_lang == "es" else "Produce the output in English."
        )

        summary_content = generate_summary(document, cleaned_text, lang_label, output_lang_instruction)
        # Experiment: keep flashcard feature code intact, but avoid sending generation prompt to AI agent.
        # generate_flashcards(document, cleaned_text, lang_label)
        generate_mcqs(document, cleaned_text, lang_label)
        generate_document_clozes(document, cleaned_text, summary_content, lang_label)
        generate_document_feynman(document, cleaned_text, summary_content, lang_label)

        document.processing_status = "completed"
        document.save(update_fields=["processing_status"])
        print(f"Successfully processed document {document.id}.")
    except Exception as exc:
        print(f"[Fatal Error] Processing failed for document {document.id}: {exc}")
        try:
            doc_to_update = Document.objects.get(id=document_id)
            doc_to_update.processing_status = "failed"
            doc_to_update.save(update_fields=["processing_status"])
        except Document.DoesNotExist:
            print(f"Document {document_id} not found for status update after error.")


def process_pdf(document_id: int) -> None:
    """Orchestrate full document processing pipeline."""
    document = Document.objects.get(id=document_id)

    try:
        if not document.pdf_file:
            raise ValueError("Document has no PDF file attached")

        print("Extracting text from PDF...")
        reader = PdfReader(document.pdf_file.path)
        text = " ".join(page.extract_text() for page in reader.pages if page.extract_text())
        print(f"Extracted {len(text)} characters.")
        process_document_text(document_id=document.id, text=text)
    except Exception as exc:
        print(f"[Fatal Error] Processing failed for document {document.id}: {exc}")
        try:
            doc_to_update = Document.objects.get(id=document_id)
            doc_to_update.processing_status = "failed"
            doc_to_update.save(update_fields=["processing_status"])
        except Document.DoesNotExist:
            print(f"Document {document_id} not found for status update after error.")
