import pytest
from API.models import Document, User
from CORE.services.cloze_generator import ClozeGenerator

@pytest.mark.django_db
def test_cloze_generator_stub_returns_empty():
    user = User.objects.create(username='u1', email='u1@example.com', password='x')
    doc = Document.objects.create(user=user, title='Doc', pdf_file='documents/dummy.pdf')
    gen = ClozeGenerator(document=doc, max_items=5)
    result = gen.generate()
    assert result == []
