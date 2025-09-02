import pytest
from API.models import User, Cloze, Document, Feynman
from VIDEO.models import Video, VideoCloze, VideoFeynman
from CORE.models import Space


@pytest.mark.django_db
def test_space_creation_defaults():
    user = User.objects.create(username='m1', email='m1@example.com', password='pwd')
    s = Space.objects.create(user=user, name='My Space')
    assert s.visibility == 'private'
    assert s.user_id == user.id
    assert str(s) == 'My Space'


@pytest.mark.django_db
def test_api_cloze_creation():
    user = User.objects.create(username='usr1', email='u1@example.com', password='pwd')
    doc = Document.objects.create(user=user, title='Doc', pdf_file='documents/dummy.pdf')
    cloze = Cloze.objects.create(document=doc, text_with_blank='The capital of France is ____.', answer='Paris')
    assert cloze.document_id == doc.id
    assert '____' in cloze.text_with_blank
    assert cloze.answer == 'Paris'


@pytest.mark.django_db
def test_video_cloze_creation():
    user = User.objects.create(username='vusr', email='v1@example.com', password='pwd')
    video = Video.objects.create(user=user, url='https://example.com/v/1')
    vc = VideoCloze.objects.create(video=video, text_with_blank='2 + 2 = ____.', answer='4')
    assert vc.video_id == video.id
    assert vc.answer == '4'


@pytest.mark.django_db
def test_api_feynman_creation():
    user = User.objects.create(username='fusr', email='f1@example.com', password='pwd')
    doc = Document.objects.create(user=user, title='Doc F', pdf_file='documents/dummy.pdf')
    f = Feynman.objects.create(document=doc, prompt='Explain gravity', key_points=['mass', 'attraction'])
    assert f.document_id == doc.id
    assert 'gravity' in f.prompt
    assert isinstance(f.key_points, list)


@pytest.mark.django_db
def test_video_feynman_creation():
    user = User.objects.create(username='vfusr', email='vf1@example.com', password='pwd')
    video = Video.objects.create(user=user, url='https://example.com/v/2')
    vf = VideoFeynman.objects.create(video=video, prompt='Explain photosynthesis', key_points=['light', 'chlorophyll'])
    assert vf.video_id == video.id
    assert 'photosynthesis' in vf.prompt
    assert 'chlorophyll' in vf.key_points
