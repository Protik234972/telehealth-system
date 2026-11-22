import re
import spacy

_nlp = None

LEMMA_OVERRIDES = {
    "uncontrolled": "uncontrolled",
    "wound": "wound",
    "wounds": "wound",
}

# Negation cues specifically signaling the ABSENCE of symptoms
NEGATION_ABSENCE_CUES = {
    "no", "without", "never", "denies", "denied", "denying",
    "none", "neither", "nor", "zero", "negative"
}

CLAUSE_BREAKERS = {
    ".", ",", ";", "!", "?", ":", "|", "(", ")", "[", "]",
    "but", "however", "although", "yet", "except", "while", "whereas",
    "still", "instead", "just", "only", "otherwise"
}


def get_spacy_model():
    """Load and configure SpaCy pipeline with clinical negation rules."""
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm", disable=["ner", "parser"])
        # Prevent 'having' from retaining 'have' and skewing Emergency weight
        _nlp.vocab["having"].is_stop = True
        # Keep negation and function words from being discarded as stopwords
        for word in [
            "no", "not", "without", "never", "cannot", "neither", "nor", "none", "zero"
        ]:
            _nlp.vocab[word].is_stop = False
    return _nlp


def preprocess_text(text: str) -> str:
    """Normalize symptom text consistently across training and live inference.

    Preserves clinical negation (e.g. 'no chest pain' -> 'no no_chest no_pain')
    while keeping critical functional impairment phrases (e.g. 'cannot breathe',
    'will not stop', 'cannot walk') as active clinical alarm tokens.
    """
    if not text:
        return ""

    t = text

    # Standardize and preserve critical clinical impairment and emergency phrases
    t = re.sub(r"\b(can't|cant|cannot)\s+(breathe|breath|breeth)\b", "cannot_breathe", t, flags=re.I)
    t = re.sub(r"\b(can't|cant|cannot)\s+walk\b", "cannot_walk", t, flags=re.I)
    t = re.sub(r"\b(can't|cant|cannot)\s+sleep\b", "cannot_sleep", t, flags=re.I)
    t = re.sub(r"\b(can't|cant|cannot)\s+speak\b", "cannot_speak", t, flags=re.I)
    t = re.sub(r"\b(will\s+not|won't|wont|cannot|can't)\s+stop\b", "will_not_stop", t, flags=re.I)
    t = re.sub(r"\b(not\s+working|failed\s+\d+\s+times)\b", "not_working", t, flags=re.I)
    t = re.sub(r"\bwithout\s+waking\s+up\b", "unresponsive_without_waking", t, flags=re.I)

    # Standardize common contractions
    t = re.sub(r"n't\b", " not", t, flags=re.I)
    t = re.sub(r"\bcan't\b", "cannot", t, flags=re.I)
    t = re.sub(r"\bcant\b", "cannot", t, flags=re.I)

    # Post-negation resolution patterns (e.g. 'pain is completely gone' -> 'no_pain')
    t = re.sub(
        r"\b(pain|ache|fever|cough|symptom|swelling|headache|nausea|stiffness|cramps?)\s+(?:is\s+)?(?:completely\s+|totally\s+|all\s+)?(?:gone|resolved|disappeared|subsided|cleared|relieved)\b",
        r"no_\1",
        t,
        flags=re.I,
    )
    t = re.sub(
        r"\b(no\s+more|free\s+of|denies\s+any|without\s+any)\s+(\w+)\b",
        r"no \2",
        t,
        flags=re.I,
    )
    t = re.sub(
        r"\b(currently\s+asymptomatic|zero\s+symptoms|no\s+active\s+symptoms|completely\s+normal\s+today|feeling\s+fine\s+today)\b",
        r"asymptomatic normal",
        t,
        flags=re.I,
    )

    # Split punctuation and delimiters between words
    t = re.sub(r"[/\\-]", " ", t)

    nlp = get_spacy_model()
    doc = nlp(t.lower())
    tokens = []
    in_negation = False
    neg_distance = 0
    max_neg_distance = 5

    for token in doc:
        text_lower = token.text.lower().strip()
        lemma = LEMMA_OVERRIDES.get(text_lower, token.lemma_.strip())

        # Reset negation scope on punctuation or clause-breaking conjunctions
        if token.is_punct or text_lower in CLAUSE_BREAKERS or lemma in CLAUSE_BREAKERS:
            in_negation = False
            neg_distance = 0
            continue

        # Check for negation of symptom presence (e.g., 'no', 'without', 'never', 'not')
        if (
            text_lower in NEGATION_ABSENCE_CUES
            or lemma in NEGATION_ABSENCE_CUES
            or (text_lower == "not" and lemma not in {"stop", "wake", "work"})
        ):
            in_negation = True
            neg_distance = 0
            tokens.append("no")
            continue

        if in_negation:
            if not token.is_stop:
                neg_distance += 1
                if neg_distance > max_neg_distance:
                    in_negation = False

        if not (token.is_alpha or "_" in token.text):
            continue

        if token.is_stop and text_lower not in NEGATION_ABSENCE_CUES and "_" not in token.text:
            continue

        if in_negation and not lemma.startswith("cannot_") and not lemma.startswith("will_not_"):
            if lemma.startswith("no_"):
                tokens.append(lemma)
            else:
                tokens.append(f"no_{lemma}")
        else:
            tokens.append(lemma)

    return " ".join(tokens)
