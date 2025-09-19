from django.db import migrations
from django.utils import timezone
from django.conf import settings

import json
import os
from pathlib import Path


BACKUP_PREFIX = "backup_pre_core_migration"


def create_backup(apps):
    """Create a JSON backup of legacy tables before data migration (idempotent)."""
    Document = apps.get_model('API', 'Document')
    Flashcard = apps.get_model('API', 'Flashcard')
    MCQ = apps.get_model('API', 'MCQ')
    Video = apps.get_model('VIDEO', 'Video')
    VideoMCQ = apps.get_model('VIDEO', 'VideoMCQ')

    backup_dir = Path(getattr(settings, 'BASE_DIR', '.')) / 'data_backups'
    backup_dir.mkdir(exist_ok=True)
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f"{BACKUP_PREFIX}_{timestamp}.json"

    # If a backup was already created in the last run (same second) skip silently
    if backup_file.exists():
        return str(backup_file)

    payload = []
    for model, label in [
        (Document, 'API.Document'), (Flashcard, 'API.Flashcard'), (MCQ, 'API.MCQ'),
        (Video, 'VIDEO.Video'), (VideoMCQ, 'VIDEO.VideoMCQ')
    ]:
        for row in model.objects.all().values():
            payload.append({'model': label, 'pk': row.get('id'), 'fields': row})

    with backup_file.open('w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2, default=str)
    return str(backup_file)


def forward(apps, schema_editor):
    """Perform data migration from legacy API/VIDEO models into CORE models.

    Steps:
    1. Backup legacy data.
    2. Create default Space per user if missing.
    3. Link Documents & Videos into Space via SpaceItem.
    4. Migrate Flashcard -> CoreLearningProgress (status mapping, SR fields).
    5. Link MCQ / VideoMCQ into Space (and create CoreLearningProgress if not existing).
    6. Validate counts.
    """
    # Historical models
    User = apps.get_model('API', 'User')
    Document = apps.get_model('API', 'Document')
    Flashcard = apps.get_model('API', 'Flashcard')
    MCQ = apps.get_model('API', 'MCQ')
    Video = apps.get_model('VIDEO', 'Video')
    VideoMCQ = apps.get_model('VIDEO', 'VideoMCQ')

    Space = apps.get_model('CORE', 'Space')
    SpaceItem = apps.get_model('CORE', 'SpaceItem')
    CoreLearningProgress = apps.get_model('CORE', 'CoreLearningProgress')

    ContentTypeModel = apps.get_model('contenttypes', 'ContentType')

    # 1. Backup
    create_backup(apps)

    # ContentTypes (need runtime model classes, so fetch IDs by app_label/model)
    def ct_for(app_label, model_name):
        """Obtain or create ContentType using historical model reference (supports unusual casing)."""
        model_lc = model_name.lower()
        ct, _ = ContentTypeModel.objects.get_or_create(app_label=app_label, model=model_lc)
        return ct

    ct_document = ct_for('API', 'Document')
    ct_flashcard = ct_for('API', 'Flashcard')
    ct_mcq = ct_for('API', 'MCQ')
    ct_video = ct_for('VIDEO', 'Video')
    ct_videomcq = ct_for('VIDEO', 'VideoMCQ')

    # Helper caches
    default_space_cache = {}

    def get_default_space(user_id):
        space = default_space_cache.get(user_id)
        if space:
            return space
        space, _created = Space.objects.get_or_create(user_id=user_id, name='Default', defaults={'description': 'Migrated default space', 'visibility': 'private'})
        default_space_cache[user_id] = space
        return space

    # 2 & 3. Documents -> SpaceItems
    doc_qs = Document.objects.all()
    doc_count = doc_qs.count()
    spaceitems_docs_created = 0
    for doc in doc_qs.iterator():
        space = get_default_space(doc.user_id)
        # ensure SpaceItem exists
        if not SpaceItem.objects.filter(space=space, content_type=ct_document, object_id=doc.id).exists():
            SpaceItem.objects.create(space=space, content_type=ct_document, object_id=doc.id, topic=None, importance=1.0)
            spaceitems_docs_created += 1

    # Videos -> SpaceItems
    video_qs = Video.objects.all()
    video_count = video_qs.count()
    spaceitems_videos_created = 0
    for vid in video_qs.iterator():
        space = get_default_space(vid.user_id)
        if not SpaceItem.objects.filter(space=space, content_type=ct_video, object_id=vid.id).exists():
            SpaceItem.objects.create(space=space, content_type=ct_video, object_id=vid.id, topic=None, importance=1.0)
            spaceitems_videos_created += 1

    # 4. Flashcards -> CoreLearningProgress
    flashcard_qs = Flashcard.objects.all()
    flashcard_count = flashcard_qs.count()
    progress_flashcards_created = 0
    status_map = {'still_learning': 'learning', 'mastered': 'mastered'}
    for fc in flashcard_qs.iterator():
        if not CoreLearningProgress.objects.filter(user_id=fc.document.user_id, content_type=ct_flashcard, object_id=fc.id).exists():
            CoreLearningProgress.objects.create(
                user_id=fc.document.user_id,
                content_type=ct_flashcard,
                object_id=fc.id,
                status=status_map.get(fc.status, 'new'),
                last_reviewed=fc.last_reviewed,
                next_review_at=fc.next_review_at,
                times_shown=fc.times_shown,
                score=fc.score,
                repetitions=fc.repetitions,
                interval=fc.interval,
                easiness=fc.easiness,
                consecutive_passes=fc.repetitions if fc.status == 'mastered' else 0,
                last_quality=0,
            )
            progress_flashcards_created += 1
        # Also link flashcard itself to space for navigation (optional)
        space = get_default_space(fc.document.user_id)
        SpaceItem.objects.get_or_create(space=space, content_type=ct_flashcard, object_id=fc.id, defaults={'topic': None, 'importance': 1.0})

    # 5. MCQ / VideoMCQ -> SpaceItems (+ optional progress entries so they participate in sessions)
    mcq_qs = MCQ.objects.all()
    mcq_count = mcq_qs.count()
    progress_mcq_created = 0
    for mcq in mcq_qs.iterator():
        space = get_default_space(mcq.document.user_id)
        SpaceItem.objects.get_or_create(space=space, content_type=ct_mcq, object_id=mcq.id, defaults={'topic': None, 'importance': 1.0})
        if not CoreLearningProgress.objects.filter(user_id=mcq.document.user_id, content_type=ct_mcq, object_id=mcq.id).exists():
            CoreLearningProgress.objects.create(
                user_id=mcq.document.user_id,
                content_type=ct_mcq,
                object_id=mcq.id,
                status='new'
            )
            progress_mcq_created += 1

    videomcq_qs = VideoMCQ.objects.all()
    videomcq_count = videomcq_qs.count()
    progress_videomcq_created = 0
    for vm in videomcq_qs.iterator():
        space = get_default_space(vm.video.user_id)
        SpaceItem.objects.get_or_create(space=space, content_type=ct_videomcq, object_id=vm.id, defaults={'topic': None, 'importance': 1.0})
        if not CoreLearningProgress.objects.filter(user_id=vm.video.user_id, content_type=ct_videomcq, object_id=vm.id).exists():
            CoreLearningProgress.objects.create(
                user_id=vm.video.user_id,
                content_type=ct_videomcq,
                object_id=vm.id,
                status='new'
            )
            progress_videomcq_created += 1

    # 6. Validation (simple integrity checks) - ensure at least one item per source object now linked
    # Documents & Videos SpaceItems (cannot guarantee equality if pre-existing, but must be >= counts)
    spaceitems_docs_total = \
        SpaceItem.objects.filter(content_type=ct_document, object_id__in=list(doc_qs.values_list('id', flat=True))).count()
    spaceitems_videos_total = \
        SpaceItem.objects.filter(content_type=ct_video, object_id__in=list(video_qs.values_list('id', flat=True))).count()

    if spaceitems_docs_total < doc_count:
        raise RuntimeError(f"Data migration validation failed: only {spaceitems_docs_total}/{doc_count} documents linked to spaces")
    if spaceitems_videos_total < video_count:
        raise RuntimeError(f"Data migration validation failed: only {spaceitems_videos_total}/{video_count} videos linked to spaces")

    # Flashcards progress entries
    progress_flashcards_total = CoreLearningProgress.objects.filter(content_type=ct_flashcard, object_id__in=list(flashcard_qs.values_list('id', flat=True))).count()
    if progress_flashcards_total < flashcard_count:
        # Not all flashcards were migrated; raise
        raise RuntimeError(f"Data migration validation failed: only {progress_flashcards_total}/{flashcard_count} flashcards have progress entries")

    # Simple log (printed to stdout during migration)
    print("[CORE MIGRATION] Documents linked:", spaceitems_docs_total, "/", doc_count)
    print("[CORE MIGRATION] Videos linked:", spaceitems_videos_total, "/", video_count)
    print("[CORE MIGRATION] Flashcards progress entries:", progress_flashcards_total)
    print("[CORE MIGRATION] MCQ progress created:", progress_mcq_created, "of", mcq_count)
    print("[CORE MIGRATION] VideoMCQ progress created:", progress_videomcq_created, "of", videomcq_count)


def reverse(apps, schema_editor):
    """Best-effort rollback: remove progress & space items for migrated content.
    Does NOT delete Spaces (could contain user data added after migration)."""
    ContentTypeModel = apps.get_model('contenttypes', 'ContentType')
    Document = apps.get_model('API', 'Document')
    Flashcard = apps.get_model('API', 'Flashcard')
    MCQ = apps.get_model('API', 'MCQ')
    Video = apps.get_model('VIDEO', 'Video')
    VideoMCQ = apps.get_model('VIDEO', 'VideoMCQ')
    SpaceItem = apps.get_model('CORE', 'SpaceItem')
    CoreLearningProgress = apps.get_model('CORE', 'CoreLearningProgress')

    def ct_for(app_label, model_name):
        model_lc = model_name.lower()
        ct, _ = ContentTypeModel.objects.get_or_create(app_label=app_label, model=model_lc)
        return ct

    for ct in [
        ct_for('API', 'Document'), ct_for('API', 'Flashcard'), ct_for('API', 'MCQ'),
        ct_for('VIDEO', 'Video'), ct_for('VIDEO', 'VideoMCQ')
    ]:
        SpaceItem.objects.filter(content_type=ct).delete()

    CoreLearningProgress.objects.filter(content_type__in=[
        ct_for('API', 'Flashcard'), ct_for('API', 'MCQ'), ct_for('VIDEO', 'VideoMCQ')
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('CORE', '0001_initial'),
        ('API', '0004_flashcard_easiness_flashcard_interval_and_more'),
        ('VIDEO', '0002_alter_video_transcript_text_alter_video_video_id'),
        ('contenttypes', '__latest__'),
    ]

    operations = [
        migrations.RunPython(forward, reverse_code=reverse),
    ]
