import pandas as pd
import random
import os

def generate_dataset(num_records=10000):
    print("Generating synthetic clinical triage dataset...")
    # Templates and keywords
    routine_templates = [
        "I have a mild {symptom} for {duration}.",
        "My {body_part} has been hurting slightly since {time}.",
        "Just a normal {symptom}, nothing too bad.",
        "Experiencing a minor {symptom} today.",
        "I've got a bit of a {symptom}.",
        "Slight discomfort in my {body_part}."
    ]
    routine_symptoms = ["cough", "headache", "sore throat", "runny nose", "rash", "fatigue", "muscle ache"]
    
    urgent_templates = [
        "I have a high fever of {temp} and a sharp {symptom}.",
        "My {body_part} is in severe pain, it started {duration} ago.",
        "Very bad {symptom}, I can't sleep.",
        "I injured my {body_part} and it's swelling fast.",
        "Intense {symptom} along with a fever.",
        "Cannot bear the pain in my {body_part}."
    ]
    urgent_symptoms = ["stomach ache", "migraine", "sprain", "vomiting", "diarrhea", "fracture", "infection"]
    
    emergency_templates = [
        "I am experiencing severe {symptom} and cannot breathe.",
        "My {body_part} is numb and I'm feeling dizzy.",
        "I think I'm having a {symptom}, call help.",
        "Uncontrollable bleeding from my {body_part}.",
        "Sudden intense {symptom}, losing consciousness.",
        "Severe {symptom}, my vision is blurry and chest is tight."
    ]
    emergency_symptoms = ["chest pain", "heart attack", "stroke symptoms", "anaphylaxis", "severe bleeding", "seizure"]
    
    body_parts = ["head", "chest", "leg", "arm", "stomach", "back", "ankle", "wrist"]
    durations = ["2 days", "3 days", "a week", "yesterday", "this morning", "a few hours", "24 hours"]
    temps = ["101F", "102F", "103F", "104F"]
    times = ["yesterday", "this morning", "last night", "two days ago", "just now"]
    
    data = []
    
    # Generate balanced dataset
    per_class = num_records // 3
    
    for _ in range(per_class):
        data.append({
            "symptom_text": random.choice(routine_templates).format(
                symptom=random.choice(routine_symptoms),
                body_part=random.choice(body_parts),
                duration=random.choice(durations),
                time=random.choice(times)
            ),
            "triage_level": "Routine"
        })
        
        data.append({
            "symptom_text": random.choice(urgent_templates).format(
                symptom=random.choice(urgent_symptoms),
                body_part=random.choice(body_parts),
                duration=random.choice(durations),
                time=random.choice(times),
                temp=random.choice(temps)
            ),
            "triage_level": "Urgent"
        })
        
        data.append({
            "symptom_text": random.choice(emergency_templates).format(
                symptom=random.choice(emergency_symptoms),
                body_part=random.choice(body_parts),
                duration=random.choice(durations),
                time=random.choice(times)
            ),
            "triage_level": "Emergency"
        })
        
    random.shuffle(data)
    df = pd.DataFrame(data)
    
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    csv_path = os.path.join(os.path.dirname(__file__), 'symptom_data.csv')
    df.to_csv(csv_path, index=False)
    print(f"Dataset generated at {csv_path} with {len(df)} records.")

if __name__ == "__main__":
    generate_dataset()
