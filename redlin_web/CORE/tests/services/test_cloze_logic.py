import pytest
from CORE.services import cloze_logic as logic

def test_simple_token_filter_rules():
	assert logic.simple_token_filter('Casa') is True
	assert logic.simple_token_filter('12') is False
	assert logic.simple_token_filter('..') is False
	assert logic.simple_token_filter('a') is False

def test_compute_frequency_scores_empty():
	assert logic.compute_frequency_scores([]) == {}

def test_extract_candidates_regex_fallback():
	text = 'Alpha beta gamma delta.'
	cands = logic.extract_candidates(text, nlp=None, limit=10)
	assert cands
	assert all('text' in c for c in cands)

def test_diverse_select_no_duplicates(monkeypatch):
	text = 'Historia historia ciencia'
	cands = [
		{'text': 'Historia', 'start':0, 'end':8, 'base_score':1.0, 'score':1.0},
		{'text': 'historia', 'start':9, 'end':17, 'base_score':0.9, 'score':0.9},
		{'text': 'ciencia', 'start':18, 'end':25, 'base_score':0.8, 'score':0.8},
	]
	sel = logic.diverse_select(cands, limit=5, nlp=None, text=text)
	texts = [c['text'].lower() for c in sel]
	assert texts.count('historia') == 1

def test_build_distractors_numeric_branch():
	answer = '4'
	base = [
		{'text': '4', 'start':0, 'end':1, 'base_score':1.0, 'score':1.0},
		{'text': 'numero', 'start':2, 'end':8, 'base_score':0.9, 'score':0.9},
		{'text': 'valor', 'start':9, 'end':14, 'base_score':0.8, 'score':0.8},
	]
	dists = logic.build_distractors(answer, base, base[0], nlp=None, count=3)
	assert len(dists) == 3
	assert answer not in dists
	assert any(d.isdigit() for d in dists)
