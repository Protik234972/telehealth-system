import spacy

_nlp = None


def get_spacy_model():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def preprocess_text(text: str) -> str:
    """Normalize symptom text consistently across training and live inference."""
    if not text:
        return ""
    nlp = get_spacy_model()
    doc = nlp(text.lower())
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop and not token.is_punct and token.is_alpha
    ]
    return " ".join(tokens)
