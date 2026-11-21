import os
import random
import pandas as pd


def _apply_light_noise(text: str, rng: random.Random) -> str:
    """Introduce realistic informal variations and mild typos for robustness."""
    replacements = {
        "cannot": rng.choice(["cannot", "can't", "cant"]),
        "experiencing": rng.choice(["experiencing", "having", "feeling"]),
        "really": rng.choice(["really", "rly", "very"]),
        "a lot": rng.choice(["a lot", "alot"]),
        "medication": rng.choice(["medication", "medicine", "meds"]),
        "appointment": rng.choice(["appointment", "appt", "consultation"]),
        "stomach": rng.choice(["stomach", "tummy", "abdomen"]),
        "temperature": rng.choice(["temperature", "temp", "fever"]),
    }
    out = text
    for src, dst in replacements.items():
        if src in out and rng.random() < 0.35:
            out = out.replace(src, dst, 1)

    if rng.random() < 0.15:
        out = out.lower()
    if rng.random() < 0.12 and out.endswith("."):
        out = out[:-1]
    return out


def generate_dataset(num_records: int = 10000, seed: int = 42):
    print("Generating deduplicated synthetic clinical triage dataset...")
    rng = random.Random(seed)

    # Routine: mild complaints, checkups, follow-ups, and prescription refills
    routine_templates = [
        "{opener}I have a mild {symptom} for {duration}{ending}",
        "{opener}My {body_part} has been aching slightly since {time}{ending}",
        "{opener}Just a normal {symptom}, nothing too bad{ending}",
        "{opener}Experiencing a minor {symptom} {time_ctx}{ending}",
        "{opener}I have had a bit of a {symptom} for {duration}{ending}",
        "{opener}Slight discomfort in my {body_part} since {time}{ending}",
        "{opener}I need a routine {checkup_type} appointment{ending}",
        "{opener}Looking to get my {med_type} prescription refilled{ending}",
        "{opener}Follow up visit needed for {chronic_issue}, feeling stable{ending}",
        "{opener}Mild {symptom} and slight tiredness over {duration}{ending}",
        "{opener}Would like to book a standard consultation for a {symptom}{ending}",
        "{opener}Not urgent, just want a doctor to check my {body_part} {time_ctx}{ending}",
        "{opener}I have a mild {symptom} that started {time}, no fever{ending}",
        "{opener}Need a routine review of my {med_type} medication{ending}",
    ]
    routine_symptoms = [
        "cough", "headache", "sore throat", "runny nose", "mild rash",
        "fatigue", "muscle ache", "seasonal allergy", "dry skin",
        "blocked nose", "mild stiffness", "minor earache", "acid reflux",
    ]
    checkup_types = [
        "blood pressure follow-up", "annual health checkup", "wellness review",
        "lab test result review", "cholesterol follow-up", "general checkup",
    ]
    med_types = [
        "blood pressure", "cholesterol", "allergy", "asthma inhaler",
        "thyroid", "daily vitamin", "reflux", "diabetes maintenance",
    ]
    chronic_issues = [
        "blood pressure monitoring", "mild eczema", "seasonal allergies",
        "routine diabetes check", "sleep hygiene", "mild back stiffness",
    ]

    # Urgent: high fever, severe non-cardiac/non-stroke pain, acute infection, informal complaints
    urgent_templates = [
        "{opener}I have a high fever of {temp} and a sharp {symptom}{ending}",
        "{opener}My {body_part} is in severe pain, it started {duration} ago{ending}",
        "{opener}Very bad {symptom}, I cannot sleep since {time}{ending}",
        "{opener}I injured my {body_part} {time} and it is swelling fast{ending}",
        "{opener}Intense {symptom} along with a persistent fever of {temp}{ending}",
        "{opener}Cannot bear the pain in my {body_part} since {time}{ending}",
        "{opener}{body_part} hurts really bad cannot sleep and feeling terrible{ending}",
        "{opener}Persistent {symptom} for {duration}, getting noticeably worse{ending}",
        "{opener}Moderate to severe {symptom} with chills since {time}{ending}",
        "{opener}Painful {infection_site} infection with redness and fever{ending}",
        "{opener}I keep throwing up and have bad {symptom} for {duration}{ending}",
        "{opener}Twisted my {body_part} badly, cannot put weight on it{ending}",
        "{opener}Strong {symptom} and coughing a lot, unable to rest{ending}",
        "{opener}Sharp pain when moving my {body_part}, started {time}{ending}",
    ]
    urgent_symptoms = [
        "stomach ache", "migraine", "sprain", "vomiting", "diarrhea",
        "suspected fracture", "ear infection", "kidney pain", "deep cut",
        "persistent cough", "urinary pain", "high fever", "severe headache",
    ]
    infection_sites = ["throat", "ear", "sinus", "skin", "urinary", "wound", "tooth"]

    # Emergency: life-threatening red flags (cardiac, respiratory, neuro, hemorrhage, anaphylaxis)
    emergency_templates = [
        "{opener}I am experiencing severe {symptom} and cannot breathe{ending}",
        "{opener}My {neuro_part} is suddenly numb and I am feeling dizzy{ending}",
        "{opener}I think I am having a {symptom}, please send help{ending}",
        "{opener}Uncontrollable bleeding from my {body_part} since {time}{ending}",
        "{opener}Sudden intense {symptom} and losing consciousness{ending}",
        "{opener}Severe {symptom}, my vision is blurry and chest feels tight{ending}",
        "{opener}Crushing chest pain radiating down my left arm and shortness of breath{ending}",
        "{opener}Throat is swelling up after eating, struggling to breathe{ending}",
        "{opener}Sudden slurred speech, facial droop, and weakness in my {neuro_part}{ending}",
        "{opener}Severe {symptom} with cold sweats and gasping for air{ending}",
        "{opener}Person collapsed with {symptom} and is barely responsive{ending}",
        "{opener}Heavy bleeding that will not stop after {duration} pressure{ending}",
        "{opener}Extreme chest pressure, sweating heavily, and feeling faint{ending}",
        "{opener}Acute {symptom} with blue lips and severe breathing difficulty{ending}",
    ]
    emergency_symptoms = [
        "chest pain", "heart attack", "stroke symptoms", "anaphylaxis",
        "severe bleeding", "seizure", "respiratory distress", "cardiac arrest",
        "severe allergic reaction", "sudden paralysis",
    ]

    openers = [
        "", "", "", "Hi doctor, ", "Hello, ", "Please advise: ",
        "Need help, ", "For triage: ", "Doctor, ", "Excuse me, ",
    ]
    endings = [
        ".", ".", " please.", ", need an appointment.", " today.",
        ", what should I do?", " right now.", " as soon as possible.",
    ]
    body_parts = [
        "head", "chest", "leg", "arm", "stomach", "back", "ankle",
        "wrist", "shoulder", "knee", "neck", "rib",
    ]
    neuro_parts = ["left arm", "face", "right side", "hand", "leg", "left side"]
    durations = [
        "2 days", "3 days", "4 days", "a week", "yesterday",
        "this morning", "a few hours", "24 hours", "several hours", "5 days",
    ]
    temps = ["101F", "102F", "103F", "104F", "39C", "39.5C", "40C"]
    times = [
        "yesterday", "this morning", "last night", "two days ago",
        "just now", "earlier today", "a few hours ago",
    ]
    time_ctxs = ["today", "this week", "over the past few days", "recently", "since morning"]

    # Realistic edge-case crossover phrases (mildly ambiguous syntax across adjacent tiers)
    ambiguous_cases = [
        ("Routine", "{opener}Mild headache and slight cough since {time}, no trouble breathing{ending}"),
        ("Routine", "{opener}Slight chest muscle soreness after lifting weights {time}, no shortness of breath{ending}"),
        ("Urgent", "{opener}Bad cough with high fever of {temp} and body aches since {time}{ending}"),
        ("Urgent", "{opener}Head hurts really bad cannot sleep coughing a lot feeling terrible since {time}{ending}"),
        ("Emergency", "{opener}Chest hurts very badly and I am struggling to catch my breath since {time}{ending}"),
    ]

    # Distribute 10,000 records evenly: 3,334 Routine, 3,333 Urgent, 3,333 Emergency
    targets = {
        "Routine": num_records // 3 + (1 if num_records % 3 >= 1 else 0),
        "Urgent": num_records // 3 + (1 if num_records % 3 >= 2 else 0),
        "Emergency": num_records // 3,
    }

    seen_texts = set()
    data = []

    def make_candidate(label: str) -> str:
        if rng.random() < 0.06:
            amb_choices = [tpl for lvl, tpl in ambiguous_cases if lvl == label]
            if amb_choices:
                tpl = rng.choice(amb_choices)
                raw = tpl.format(
                    opener=rng.choice(openers),
                    time=rng.choice(times),
                    temp=rng.choice(temps),
                    ending=rng.choice(endings),
                )
                return _apply_light_noise(raw.strip(), rng)

        if label == "Routine":
            tpl = rng.choice(routine_templates)
            raw = tpl.format(
                opener=rng.choice(openers),
                symptom=rng.choice(routine_symptoms),
                body_part=rng.choice(body_parts),
                duration=rng.choice(durations),
                time=rng.choice(times),
                time_ctx=rng.choice(time_ctxs),
                checkup_type=rng.choice(checkup_types),
                med_type=rng.choice(med_types),
                chronic_issue=rng.choice(chronic_issues),
                ending=rng.choice(endings),
            )
        elif label == "Urgent":
            tpl = rng.choice(urgent_templates)
            raw = tpl.format(
                opener=rng.choice(openers),
                symptom=rng.choice(urgent_symptoms),
                body_part=rng.choice(body_parts),
                duration=rng.choice(durations),
                time=rng.choice(times),
                temp=rng.choice(temps),
                infection_site=rng.choice(infection_sites),
                ending=rng.choice(endings),
            )
        else:
            tpl = rng.choice(emergency_templates)
            raw = tpl.format(
                opener=rng.choice(openers),
                symptom=rng.choice(emergency_symptoms),
                body_part=rng.choice(body_parts),
                neuro_part=rng.choice(neuro_parts),
                duration=rng.choice(durations),
                time=rng.choice(times),
                ending=rng.choice(endings),
            )
        return _apply_light_noise(raw.strip(), rng)

    for label, count in targets.items():
        attempts = 0
        added = 0
        while added < count and attempts < count * 50:
            attempts += 1
            text = make_candidate(label)
            norm = text.lower()
            if norm not in seen_texts:
                seen_texts.add(norm)
                data.append({"symptom_text": text, "triage_level": label})
                added += 1
        if added < count:
            raise RuntimeError(f"Could only generate {added}/{count} unique samples for {label}")

    rng.shuffle(data)
    df = pd.DataFrame(data)

    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    csv_path = os.path.join(os.path.dirname(__file__), "symptom_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"Dataset generated at {csv_path} with {len(df)} unique records.")


if __name__ == "__main__":
    generate_dataset()
