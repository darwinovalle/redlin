import pytest

from CORE.services.cloze_generator import extract_candidates, compute_frequency_scores, get_nlp
from CORE.services.cloze_generator import ClozeGenerator
from API.models import Document
from API.models import User


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


@pytest.mark.django_db
def test_scoring_and_diversity_selection(monkeypatch):
    # Create minimal document
    user = User.objects.create(username="u1", email="u1@example.com", password="x")
    # Create a dummy file-like path (FileField requires a name; using simple string since storage not accessed in test)
    doc = Document.objects.create(user=user, title="Doc", pdf_file="dummy.pdf")
    # Monkeypatch content attribute via summary-like synthetic property for extraction test (we just use variable text)
    text = "Albert Einstein desarrolló la teoría de la relatividad en 1905. Einstein cambió la física."

    gen = ClozeGenerator(doc, max_items=5)
    # Use local text variable since Document model lacks 'content' field
    nlp = get_nlp("es")  # may be None; still want base scoring
    cands = gen._select_base_candidates(text, nlp)
    gen._apply_scoring(cands, text, nlp)
    selected = gen._diverse_select(cands, limit=3)
    assert 1 <= len(selected) <= 3
    # Ensure no duplicate texts
    texts = [c['text'].lower() for c in selected]
    assert len(texts) == len(set(texts))
