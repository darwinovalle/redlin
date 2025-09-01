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

from API.models import Cloze, Summary

@pytest.mark.django_db
def test_generate_creates_items_with_blank(monkeypatch):
    user = User.objects.create(username='u', email='u@example.com', password='x')
    doc = Document.objects.create(user=user, title='Relatividad', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='Albert Einstein desarrolló la teoría de la relatividad en 1905. Einstein cambió la física moderna.')
    gen = ClozeGenerator(doc, max_items=3)
    items = gen.generate()
    assert 1 <= len(items) <= 3
    for c in items:
        assert '____' in c.text_with_blank
        assert c.answer
        assert isinstance(c.meta, dict)

@pytest.mark.django_db
def test_generate_respects_max_items():
    user = User.objects.create(username='u2', email='u2@example.com', password='x')
    doc = Document.objects.create(user=user, title='Historia', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='La revolución industrial transformó la producción y la sociedad en Europa y el mundo moderno de forma rápida y profunda.')
    gen = ClozeGenerator(doc, max_items=2)
    items = gen.generate()
    assert len(items) <= 2

@pytest.mark.django_db
def test_generate_short_text_returns_empty():
    user = User.objects.create(username='u3', email='u3@example.com', password='x')
    doc = Document.objects.create(user=user, title='Corto', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='Hola mundo corto')
    gen = ClozeGenerator(doc, max_items=5)
    assert gen.generate() == []
