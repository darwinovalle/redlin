import os

from PyPDF2 import PdfReader

from API.models import Document

from .cloze_generation_service import generate_document_clozes
from .feynman_generation_service import generate_document_feynman
# from .flashcard_generation_service import generate_flashcards
from .mcq_generation_service import generate_mcqs
from .processing_common import detect_language
from .summary_generation_service import generate_summary

# Per-chapter/batch processing budget (quality ceiling). Env-overridable. If the
# extracted text exceeds this, only the first MAX_CHAPTER_CHARS characters are
# processed so the LLM stays within a quality-focused window.
MAX_CHAPTER_CHARS = int(os.getenv("MAX_CHAPTER_CHARS", "60000"))


def process_document_text(document_id: int, text: str, meta: dict | None = None) -> None:
    """Run the generation pipeline on the provided text (optionally recording meta)."""
    document = Document.objects.get(id=document_id)
    if document.processing_status == "completed":
        print(f"Document {document_id} already processed. Skipping.")
        return

    document.processing_status = "processing"
    if meta:
        current_meta = dict(document.source_meta or {})
        current_meta.update(meta)
        document.source_meta = current_meta
    document.save(update_fields=["processing_status", "source_meta"])
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


def process_pdf(document_id: int, page_start: int | None = None, page_end: int | None = None) -> None:
    """Orchestrate full document processing pipeline.

    For a Book chapter, the parent book's PDF is used and only the chapter's
    page range is extracted and processed.
    """
    document = Document.objects.get(id=document_id)
    source = document.source_document

    try:
        if not source.pdf_file:
            raise ValueError("Document has no PDF file attached")

        print("Extracting text from PDF...")
        reader = PdfReader(source.pdf_file.path)
        total_pages = len(reader.pages)
        start = max(0, (page_start or 1) - 1)
        end = min(page_end or total_pages, total_pages)
        pages = reader.pages[start:end]
        raw_text = " ".join(page.extract_text() for page in pages if page.extract_text())
        # Safety net: cap a single chapter's processed text so the LLM is not
        # given more than the quality budget (the UI warns users to split large
        # chapters, but this enforces it server-side too).
        truncated = len(raw_text) > MAX_CHAPTER_CHARS
        text = raw_text[:MAX_CHAPTER_CHARS] if truncated else raw_text
        meta = {
            "total_pages": total_pages,
            "processed_page_start": start + 1,
            "processed_page_end": end,
            "processed_chars": len(text),
            "truncated": truncated,
        }
        print(f"Extracted {len(text)} characters from pages {start + 1}-{end} of {total_pages}."
              + (" [capped at MAX_CHAPTER_CHARS]" if truncated else ""))
        process_document_text(document_id=document.id, text=text, meta=meta)
    except Exception as exc:
        print(f"[Fatal Error] Processing failed for document {document.id}: {exc}")
        try:
            doc_to_update = Document.objects.get(id=document_id)
            doc_to_update.processing_status = "failed"
            doc_to_update.save(update_fields=["processing_status"])
        except Document.DoesNotExist:
            print(f"Document {document_id} not found for status update after error.")