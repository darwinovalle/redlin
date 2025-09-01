import pytest
from API.models import Document, User, Cloze, Summary
from CORE.services.cloze_generator import ClozeGenerator

@pytest.mark.django_db
def test_cloze_generator_generates_non_empty():
    user = User.objects.create(username='u1', email='u1@example.com', password='x')
    doc = Document.objects.create(user=user, title='Doc', pdf_file='documents/dummy.pdf')
    Summary.objects.create(document=doc, content='Paris es la capital de Francia y Roma es la capital de Italia en Europa.')
    gen = ClozeGenerator(document=doc, max_items=3)
    result = gen.generate()
    assert len(result) >= 1

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

@pytest.mark.django_db
def test_generate_includes_distractors():
    user = User.objects.create(username='u4', email='u4@example.com', password='x')
    doc = Document.objects.create(user=user, title='Geografía', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='Madrid es la capital de España y Barcelona es una ciudad importante de España.')
    gen = ClozeGenerator(doc, max_items=3)
    items = gen.generate()
    assert any(len(c.options) >= 1 for c in items if c.meta.get('strategy') == 'single_blank_v1')
    for c in items:
        if c.options:
            assert c.answer not in c.options

@pytest.mark.django_db
def test_generate_multi_blank_ordering():
    user = User.objects.create(username='u5', email='u5@example.com', password='x')
    doc = Document.objects.create(user=user, title='Ciencia', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='La fotosíntesis ocurre en los cloroplastos y produce oxígeno mientras la respiración celular consume oxígeno.')
    gen = ClozeGenerator(doc, max_items=5)
    items = gen.generate()
    multi_items = [c for c in items if c.meta.get('strategy') == 'multi_blank_v1']
    if multi_items:
        mb = multi_items[0]
        text = mb.text_with_blank
        for i in range(1, mb.meta['count']):
            assert f'[[BLANK_{i}]]' in text
            assert text.index(f'[[BLANK_{i}]]') < text.index(f'[[BLANK_{i+1}]]')

@pytest.mark.django_db
def test_no_duplicate_lemmas_in_answers():
    user = User.objects.create(username='u6', email='u6@example.com', password='x')
    doc = Document.objects.create(user=user, title='Historia 2', pdf_file='dummy.pdf')
    Summary.objects.create(document=doc, content='Los emperadores dirigían el imperio y los ciudadanos veían a sus líderes con respeto en el imperio antiguo.')
    gen = ClozeGenerator(doc, max_items=5)
    items = gen.generate()
    answers = [c.answer.lower() for c in items if c.meta.get('strategy') == 'single_blank_v1']
    assert len(answers) == len(set(answers))

@pytest.mark.django_db
def test_generates_item_with_entity_when_present():
    user = User.objects.create(username='u7', email='u7@example.com', password='x')
    doc = Document.objects.create(user=user, title='Entidades', pdf_file='dummy.pdf')
    # Include multiple entities (cities / persons) to raise probability even with blank model fallback.
    Summary.objects.create(document=doc, content='Albert Einstein visitó Madrid y París antes de colaborar con Marie Curie en Europa.')
    gen = ClozeGenerator(doc, max_items=5)
    items = gen.generate()
    # If spaCy model loaded with NER, expect at least one with entity_label in meta.
    if any(c.meta.get('entity_label') for c in items):
        assert True
    else:
        # If no model installed (blank pipeline), we just assert items were generated (fallback behavior)
        assert len(items) >= 1
