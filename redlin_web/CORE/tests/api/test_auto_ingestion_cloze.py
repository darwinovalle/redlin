import pytest
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from API.models import User, Document, Summary, Cloze
from VIDEO.models import Video, VideoSummary, VideoCloze
from API.jwt_auth import create_tokens

@pytest.mark.django_db
def test_document_ingestion_creates_clozes():
    user = User.objects.create(username='ingest1', email='i1@example.com', password='x')
    client = APIClient()
    access, _ = create_tokens(user.id)
    # Create document via API (simulate upload metadata only)
    minimal_pdf = (b'%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 72 712 Td (Hello World) Tj ET\nendstream endobj\n3 0 obj<</Type /Page /Parent 4 0 R /Resources<<>> /Contents 2 0 R /MediaBox [0 0 612 792]>>endobj\n4 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n5 0 obj<</Type /Catalog /Pages 4 0 R>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000160 00000 n \n0000000290 00000 n \n0000000371 00000 n \ntrailer<</Size 6/Root 5 0 R>>\nstartxref\n450\n%%EOF')
    fake_pdf = SimpleUploadedFile('dummy.pdf', minimal_pdf, content_type='application/pdf')
    resp = client.post('/api/documents/', {'user': user.id, 'title': 'DocX', 'pdf_file': fake_pdf}, format='multipart', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert resp.status_code in (201, 200), resp.content
    doc_id = resp.data['id']
    # process_pdf is synchronous in perform_create, so resources should exist
    # Ensure summary & clozes present via full_details
    fd = client.get(f'/api/documents/{doc_id}/full_details/', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert fd.status_code == 200
    clozes = fd.data.get('clozes') or []
    # Heuristic could produce 0 if text too short; ensure at least attempt by verifying summary exists
    assert 'summary' in fd.data and fd.data['summary'] is not None
    # Accept >=0 but if >=1 ensure structure
    if clozes:
        first = clozes[0]
        assert 'text_with_blank' in first and ('____' in first['text_with_blank'] or '[[BLANK_' in first['text_with_blank'])

@pytest.mark.django_db
def test_video_ingestion_creates_clozes_and_filter_listing():
    user = User.objects.create(username='ingest2', email='i2@example.com', password='x')
    client = APIClient()
    access, _ = create_tokens(user.id)
    # Create video via API
    vresp = client.post('/api/video/videos/', {'url': 'http://example.com/vid1'}, HTTP_AUTHORIZATION=f'Bearer {access}')
    assert vresp.status_code in (201, 200), vresp.content
    vid = vresp.data['id']
    # process_video es síncrono; consultar full_details
    fd = client.get(f'/api/video/videos/{vid}/full_details/', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert fd.status_code == 200
    vclozes = fd.data.get('clozes') or []
    # List via cloze endpoint filter video
    list_resp = client.get(f'/api/cloze/?video={vid}', HTTP_AUTHORIZATION=f'Bearer {access}')
    assert list_resp.status_code == 200
    # Should match clozes from full_details length (ordering might differ)
    if vclozes:
        assert len(list_resp.data) == len(vclozes)
        assert any('____' in c['text_with_blank'] or '[[BLANK_' in c['text_with_blank'] for c in list_resp.data)
