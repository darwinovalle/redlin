"""Celery tasks for video processing.

Video processing (transcription + LLM generation) can take minutes for long
uploads or YouTube downloads, so the view dispatches it to the worker instead
of blocking the HTTP request.
"""
from celery import shared_task


@shared_task(bind=True, name="VIDEO.tasks.process_video_task")
def process_video_task(self, video_id_db: int, languages=None):
    from .ai import process_video
    process_video(video_id_db, languages=languages)
    return {"video_id": video_id_db, "status": "done"}


@shared_task(bind=True, name="VIDEO.tasks.process_video_file_task")
def process_video_file_task(self, video_id_db: int):
    from .ai import process_video_file
    process_video_file(video_id_db)
    return {"video_id": video_id_db, "status": "done"}