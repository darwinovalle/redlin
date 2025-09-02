import pytest
from rest_framework.test import APIClient
from API.models import User, Document, Summary, Cloze
from VIDEO.models import Video, VideoSummary, VideoCloze
from API.jwt_auth import create_tokens
from CORE.services.cloze_generator import ClozeGenerator, VideoClozeGenerator

@pytest.mark.django_db
def test_document_clozes_subresource():
    user = User.objects.create(username='subdoc', email='s@e.com', password='x')
    doc = Document.create(user=user, title='Doc', pdf_file='dummy.pdf') if hasattr(Document,'create') else Document.objects.create(user=user, title='Doc', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='Contenido científico de ejemplo con física y química.')
    ClozeGenerator(doc, max_items=2).generate()
    client = APIClient()
    access,_ = create_tokens(user.id)
    r = client.get(f'/api/documents/{doc.id}/clozes/', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert r.status_code == 200
    assert len(r.data) >= 1

@pytest.mark.django_db
def test_video_clozes_subresource():
    user = User.objects.create(username='subvid', email='v@e.com', password='x')
    transcript = ('Este video explica biología celular avanzada con núcleo y membrana plasmática, ' \
                  'incluyendo mitocondrias, ribosomas, retículo endoplasmático y procesos de respiración celular. ' \
                  'La estructura de la célula eucariota permite compartimentalización eficiente.')
    video = Video.objects.create(user=user, url='http://example.com', transcript_text=transcript)
    VideoSummary.objects.create(video=video, content='Resumen bio extenso que describe la biología celular, estructura de la membrana plasmática, funciones de orgánulos y procesos metabólicos fundamentales para la vida.')
    VideoClozeGenerator(video, max_items=2).generate()
    client = APIClient()
    access,_ = create_tokens(user.id)
    r = client.get(f'/api/video/videos/{video.id}/clozes/', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert r.status_code == 200
    assert len(r.data) >= 1
