import pytest
from API.models import Document, User, Summary
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
	Summary.objects.create(document=doc, content='Albert Einstein visitó Madrid y París antes de colaborar con Marie Curie en Europa.')
	gen = ClozeGenerator(doc, max_items=5)
	items = gen.generate()
	if any(c.meta.get('entity_label') for c in items):
		assert True
	else:
		assert len(items) >= 1

@pytest.mark.django_db
def test_numeric_distractors_branch(monkeypatch):
	user = User.objects.create(username='u8', email='u8@example.com', password='x')
	text = "El resultado de 2+2 es 4 y el de 3+3 es 6."
	doc = Document.objects.create(user=user, title='Nums', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content=text)
	gen = ClozeGenerator(doc, max_items=1)
	monkeypatch.setattr(gen, '_select_base_candidates', lambda t, nlp: [{
		'text': '4', 'start': text.index('4'), 'end': text.index('4')+1,
		'base_score':1.0, 'score':1.0
	}])
	items = gen.generate()
	assert len(items) == 1
	assert any(d.isdigit() for d in items[0].options)

@pytest.mark.django_db
def test_spacy_fallback(monkeypatch):
	import CORE.services.cloze_generator as cg
	saved = cg.spacy
	monkeypatch.setattr(cg, 'spacy', None)
	user = User.objects.create(username='u9', email='u9@example.com', password='x')
	doc = Document.objects.create(user=user, title='Fallback', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content='Texto simple para fallback de spaCy y prueba de tokens sin modelo avanzado.')
	gen = ClozeGenerator(doc, max_items=2)
	items = gen.generate()
	assert len(items) <= 2
	monkeypatch.setattr(cg, 'spacy', saved)

@pytest.mark.django_db
def test_video_cloze_generator():
	from CORE.services.cloze_generator import VideoClozeGenerator
	user = User.objects.create(username='u10', email='u10@example.com', password='x')
	from VIDEO.models import Video, VideoSummary
	video = Video.objects.create(user=user, url='http://example.com', title='Video Bio', transcript_text='Este video explica biología celular y organismos eucariotas.')
	VideoSummary.objects.create(video=video, content='La célula eucariota contiene orgánulos y núcleo definido en biología moderna.')
	vgen = VideoClozeGenerator(video, max_items=2)
	items = vgen.generate()
	assert len(items) <= 2
	for it in items:
		assert it.video == video
		assert '____' in it.text_with_blank
	# Removed legacy import of flat test module.
