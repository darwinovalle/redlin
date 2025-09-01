import pytest

from CORE.services.cloze_generator import extract_candidates, compute_frequency_scores, get_nlp


def test_extract_candidates_basic_without_spacy():
    text = "El rápido zorro marrón salta sobre el perro perezoso en el jardín de la casa antigua."
    cands = extract_candidates(text, nlp=None, limit=10)
    assert cands, "Should return candidates even without spaCy"
    # Ensure structure
    first = cands[0]
    assert {"text", "start", "end", "score"}.issubset(first.keys())
    # Positions must map original text
    for c in cands[:5]:
        s, e = c["start"], c["end"]
        assert text[s:e] == c["text"]


def test_compute_frequency_scores_scaling():
    words = ["alpha", "beta", "alpha", "gamma", "alpha", "beta"]
    freq = compute_frequency_scores(words)
    assert freq["alpha"] == 1.0  # most frequent scaled to 1
    assert 0 < freq["beta"] < 1
    assert 0 < freq["gamma"] < 1


def test_get_nlp_cache_idempotent():
    n1 = get_nlp("es")
    n2 = get_nlp("es")
    if n1 is None:
        pytest.skip("spaCy not installed in test environment")
    assert n1 is n2, "get_nlp should return cached instance for same language"
