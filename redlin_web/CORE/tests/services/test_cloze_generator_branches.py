import pytest
from API.models import User, Document, Summary
from CORE.services.cloze_generator import ClozeGenerator

@pytest.mark.django_db
def test_heuristic_difficulty_branches():
	user = User.objects.create(username='d1', email='d1@example.com', password='x')
	doc = Document.objects.create(user=user, title='Diff', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content='X')
	gen = ClozeGenerator(doc, max_items=1)
	easy_short = {'text': 'casa', 'score': 0.8}
	assert gen._heuristic_difficulty(easy_short) == 'easy'
	hard_entity = {'text': 'Universidad Nacional', 'score': 1.25, 'entity_label': 'ORG'}
	assert gen._heuristic_difficulty(hard_entity) == 'easy'
	hard_long = {'text': 'hipercompetitividad', 'score': 1.0}
	assert gen._heuristic_difficulty(hard_long) == 'medium'
	easy_low = {'text': 'palabra', 'score': 0.7}
	assert gen._heuristic_difficulty(easy_low) == 'medium'
	medium_default = {'text': 'contexto', 'score': 1.0}
	assert gen._heuristic_difficulty(medium_default) == 'medium'

@pytest.mark.django_db
def test_multi_blank_creation_three_and_none(monkeypatch):
	user = User.objects.create(username='d2', email='d2@example.com', password='x')
	doc = Document.objects.create(user=user, title='MB', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content='T')
	gen = ClozeGenerator(doc, max_items=5)
	text = 'Alpha beta gamma delta epsilon zeta eta.'
	cands = [
		{'text': 'Alpha', 'start': 0, 'end': 5, 'score': 1.3},
		{'text': 'gamma', 'start': 12, 'end': 17, 'score': 1.2},
		{'text': 'epsilon', 'start': 24, 'end': 31, 'score': 1.1},
		{'text': 'eta', 'start': 37, 'end': 40, 'score': 1.0},
	]
	mb = gen._create_multi_blank(text, cands, nlp=None)
	assert mb is not None
	assert mb.meta.get('strategy') == 'multi_blank_v1'
	assert mb.meta.get('count') >= 2
	mb_none = gen._create_multi_blank(text, cands[:1], nlp=None)
	assert mb_none is None

@pytest.mark.django_db
def test_diverse_select_filters_duplicates():
	user = User.objects.create(username='d3', email='d3@example.com', password='x')
	doc = Document.objects.create(user=user, title='Div', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content='D')
	gen = ClozeGenerator(doc, max_items=5)
	cands = [
		{'text': 'Historia', 'start': 0, 'end': 8, 'score': 1.1},
		{'text': 'historia', 'start': 10, 'end': 18, 'score': 1.0},
		{'text': 'Ciencia', 'start': 20, 'end': 27, 'score': 1.05},
	]
	selected = gen._diverse_select(cands, limit=5, nlp=None, text='Historia historia Ciencia')
	texts = [c['text'].lower() for c in selected]
	assert texts.count('historia') == 1

@pytest.mark.django_db
def test_distractor_fallback_relax(monkeypatch):
	user = User.objects.create(username='d4', email='d4@example.com', password='x')
	doc = Document.objects.create(user=user, title='Dist', pdf_file='dummy.pdf')
	Summary.objects.create(document=doc, content='D')
	gen = ClozeGenerator(doc, max_items=1)
	answer_cand = {'text': 'Madrid', 'start': 0, 'end': 6, 'score': 1.2, 'pos': 'PROPN'}
	base = [answer_cand,
			{'text': 'capital', 'start': 8, 'end': 15, 'score': 1.0, 'pos': 'NOUN'},
			{'text': 'ciudad', 'start': 16, 'end': 22, 'score': 0.9, 'pos': 'NOUN'},
			{'text': 'Europa', 'start': 23, 'end': 29, 'score': 1.1, 'pos': 'PROPN'}]
	dists = gen._build_distractors('Madrid', base, answer_cand, nlp=None, count=3)
	assert len(dists) == 3
	assert 'Madrid' not in dists
