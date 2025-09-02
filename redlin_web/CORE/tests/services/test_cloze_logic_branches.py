import types
import pytest
from CORE.services import cloze_logic as logic
from CORE.services import cloze_generator as gen_mod

class FakeToken:
	def __init__(self, idx, text, lemma, pos):
		self.idx = idx
		self.text = text
		self.lemma_ = lemma
		self.pos_ = pos

class FakeEnt:
	def __init__(self, start_char, end_char, text, label):
		self.start_char = start_char
		self.end_char = end_char
		self.text = text
		self.label_ = label

class FakeChunk:
	def __init__(self, start_char, end_char, text):
		self.start_char = start_char
		self.end_char = end_char
		self.text = text

class FakeDoc:
	def __init__(self, text):
		words = text.split()
		tokens = []
		cursor = 0
		for w in words:
			tokens.append(FakeToken(cursor, w, w.lower().strip('.,'), 'PROPN' if w.istitle() else 'NOUN'))
			cursor += len(w) + 1
		self._tokens = tokens
		if tokens:
			first = tokens[0]
			self.ents = [FakeEnt(first.idx, first.idx+len(first.text), first.text, 'ORG')]
		else:
			self.ents = []
		self.noun_chunks = []
		if len(tokens) >= 2:
			a, b = tokens[0], tokens[1]
			self.noun_chunks.append(FakeChunk(a.idx, b.idx+len(b.text), f"{a.text} {b.text}"))
		self.text = text
	def __iter__(self):
		return iter(self._tokens)

class FakeNLP:
	def __call__(self, text):
		return FakeDoc(text)

@pytest.mark.parametrize('limit', [5,2])
def test_extract_candidates_with_fake_nlp(limit):
	nlp = FakeNLP()
	text = 'Alpha Beta gamma delta'
	cands = logic.extract_candidates(text, nlp=nlp, limit=limit)
	assert cands
	assert all('score' in c for c in cands)

def test_apply_entity_pos_scoring_and_diverse():
	nlp = FakeNLP()
	text = 'Alpha Beta gamma'
	cands = logic.extract_candidates(text, nlp=nlp, limit=10)
	logic.apply_entity_pos_scoring(cands, text, nlp)
	assert any(c.get('entity_label') for c in cands)
	assert any(c.get('pos') for c in cands)
	selected = logic.diverse_select(cands, limit=5, nlp=nlp, text=text)
	assert selected

def test_build_distractors_fallback_relax_non_numeric():
	answer = 'Alpha'
	base = [
		{'text': 'Alpha', 'start':0, 'end':5, 'base_score':1.0, 'score':1.0, 'pos':'PROPN', 'entity_label':'ORG'},
		{'text': 'ZZZZZZ', 'start':6, 'end':12, 'base_score':0.5, 'score':0.5, 'pos':'NOUN'},
	]
	cand = base[0]
	dists = logic.build_distractors(answer, base, cand, nlp=None, count=3)
	assert len(dists) >= 1
	assert answer not in dists

def test_get_nlp_paths_monkeypatched(monkeypatch):
	fake_spacy = types.SimpleNamespace()
	calls = {'load':0,'blank':0}
	def fake_load(name):
		calls['load'] += 1
		raise OSError('model missing')
	class DummyNLP:
		def __call__(self, text):
			return FakeDoc(text)
	def fake_blank(lang):
		calls['blank'] += 1
		return DummyNLP()
	fake_spacy.load = fake_load
	fake_spacy.blank = fake_blank
	monkeypatch.setattr(gen_mod, 'spacy', fake_spacy)
	gen_mod._NLP_CACHE.clear()
	n1 = gen_mod.get_nlp('es')
	n2 = gen_mod.get_nlp('es')
	assert n1 is n2
	assert calls['load'] >= 1
	assert calls['blank'] == 1

@pytest.mark.django_db
def test_create_multi_blank_medium_and_hard(monkeypatch, django_db_blocker):
	from CORE.services.cloze_generator import ClozeGenerator
	from API.models import User, Document, Summary
	with django_db_blocker.unblock():
		user = User.objects.create(username='mbu', email='mbu@example.com', password='x')
		doc = Document.objects.create(user=user, title='T', pdf_file='dummy.pdf')
		Summary.objects.create(document=doc, content='X')
	gen = ClozeGenerator(doc, max_items=5)
	text = 'Uno dos tres cuatro cinco seis'
	two = [
		{'text':'Uno','start':0,'end':3,'score':1.2},
		{'text':'tres','start':8,'end':12,'score':1.1},
	]
	mb_medium = gen._create_multi_blank(text, two, nlp=None)
	assert mb_medium is not None
	assert mb_medium.difficulty == 'medium'
	three = two + [{'text':'cinco','start':19,'end':24,'score':1.0}]
	mb_hard = gen._create_multi_blank(text, three, nlp=None)
	assert mb_hard is not None
	assert mb_hard.difficulty == 'hard'
