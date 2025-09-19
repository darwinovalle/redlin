import pytest
from API.models import User, Document, Summary, Cloze
from CORE.services import cloze_generator as cg_mod
from CORE.services.cloze_generator import ClozeGenerator

@pytest.mark.django_db
def test_generate_adds_multi_blank_when_capacity(monkeypatch):
	user = User.objects.create(username='gp1', email='gp1@example.com', password='x')
	doc = Document.objects.create(user=user, title='Doc M', pdf_file='dummy.pdf')
	text = (
		'Albert Einstein desarrolló teoría relatividad y Marie Curie investigó radiactividad '
		'mientras Nikola Tesla experimentó electricidad avanzada en laboratorio moderno.'
	)
	Summary.objects.create(document=doc, content=text)
	gen = ClozeGenerator(doc, max_items=4)
	def small_select(cands, limit, nlp=None, text=''):
		return sorted(cands, key=lambda x: x['score'], reverse=True)[:2]
	monkeypatch.setattr(gen, '_diverse_select', small_select)
	items = gen.generate()
	strategies = [c.meta.get('strategy') for c in items]
	assert 'multi_blank_v1' in strategies
	assert any(s == 'single_blank_v1' for s in strategies)

@pytest.mark.django_db
def test_generate_no_multi_blank_when_full(monkeypatch):
	user = User.objects.create(username='gp2', email='gp2@example.com', password='x')
	doc = Document.objects.create(user=user, title='Doc N', pdf_file='dummy.pdf')
	text = 'Python Django Flask FastAPI Tornado Pyramid frameworks populares.'
	Summary.objects.create(document=doc, content=text)
	gen = ClozeGenerator(doc, max_items=3)
	def fake_base(_text, _nlp):
		words = ["Python", "Django", "Flask", "FastAPI", "Tornado"]
		cands = []
		base_score = 1.5
		for i, w in enumerate(words):
			start = text.index(w)
			end = start + len(w)
			score = base_score - (i * 0.1)
			cands.append({'text': w,'start': start,'end': end,'base_score': score,'score': score})
		return cands
	monkeypatch.setattr(gen, '_select_base_candidates', fake_base)
	def full_select(cands, limit, nlp=None, text=''):
		return sorted(cands, key=lambda x: x['score'], reverse=True)[:limit]
	monkeypatch.setattr(gen, '_diverse_select', full_select)
	called = {'mb': False}
	orig_mb = gen._create_multi_blank
	def mb_wrapper(text2, cands, nlp):
		called['mb'] = True
		return orig_mb(text2, cands, nlp)
	monkeypatch.setattr(gen, '_create_multi_blank', mb_wrapper)
	items = gen.generate()
	assert all(c.meta.get('strategy') == 'single_blank_v1' for c in items)
	assert called['mb'] is False

class FakeNLPError:
	def __call__(self, text: str):
		raise RuntimeError('forced nlp error')

@pytest.mark.django_db
def test_generate_with_nlp_exception(monkeypatch):
	user = User.objects.create(username='gp3', email='gp3@example.com', password='x')
	doc = Document.objects.create(user=user, title='Doc E', pdf_file='dummy.pdf')
	text = 'Errores controlados deben activar fallback regex tokens para generación robusta.'
	Summary.objects.create(document=doc, content=text)
	gen = ClozeGenerator(doc, max_items=2)
	monkeypatch.setattr(cg_mod, 'get_nlp', lambda lang='es': FakeNLPError())
	items = gen.generate()
	assert len(items) <= 2
	assert all(isinstance(c, Cloze) for c in items)
