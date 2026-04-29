"""Celery tasks for API app.

This module is auto-discovered by Celery. Keep imports lightweight and avoid
side effects at module import time.
"""

from celery import shared_task

from .services.document_processing_service import process_pdf as process_pdf_service


def process_pdf(document_id: int) -> None:
    """Backward-compatible sync entrypoint used by existing callers."""
    process_pdf_service(document_id)


@shared_task(bind=True, name="API.tasks.process_pdf")
def process_pdf_task(self, document_id: int):
    """Async wrapper to process a document through the AI pipeline."""
    process_pdf_service(document_id)
    return {"status": "ok", "document_id": document_id}
