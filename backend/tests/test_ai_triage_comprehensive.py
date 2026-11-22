"""
Comprehensive Clinical AI Triage Model & Backend Inference Test Suite
Tests backend/ml/triage_model.pkl under:
- Mode A (Live backend/main.py behavior): raw string input to model.predict([text])
- Mode B (Preprocessed pipeline behavior): preprocess_text(text) input to model.predict([processed])
"""

import sys
import os
import json
import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from ml.preprocess import preprocess_text

# Define comprehensive 65 clinical test cases across all categories and edge cases
TEST_CASES = [
    # --- 1. CARDIAC (Ground Truth: Emergency) ---
    {
        "id": "CARD-01",
        "category": "Cardiac",
        "text": "Severe crushing chest pain radiating down left arm and into jaw, profuse sweating, shortness of breath",
        "expected": "Emergency",
        "rationale": "Classic Acute Coronary Syndrome (STEMI/NSTEMI) presentation."
    },
    {
        "id": "CARD-02",
        "category": "Cardiac",
        "text": "Intense substernal chest pressure feeling like an elephant sitting on chest with dizziness and nausea",
        "expected": "Emergency",
        "rationale": "Severe acute angina/infarction red flag."
    },
    {
        "id": "CARD-03",
        "category": "Cardiac",
        "text": "Sudden heart palpitations, pulse 190 bpm, feeling faint and lips turning blue",
        "expected": "Emergency",
        "rationale": "Hemodynamically unstable tachydysrhythmia with cyanosis."
    },
    {
        "id": "CARD-04",
        "category": "Cardiac",
        "text": "Patient collapsed suddenly after clutching chest, currently unresponsive",
        "expected": "Emergency",
        "rationale": "Suspected cardiac arrest / syncope requiring immediate resuscitation."
    },

    # --- 2. RESPIRATORY (Ground Truth: Emergency) ---
    {
        "id": "RESP-01",
        "category": "Respiratory",
        "text": "Severe acute asthma exacerbation, gasping for air, rescue inhaler failed 4 times, cannot speak full words",
        "expected": "Emergency",
        "rationale": "Status asthmaticus with impending respiratory failure."
    },
    {
        "id": "RESP-02",
        "category": "Respiratory",
        "text": "Choking on a piece of food, cannot cough or breathe, stridor and blue discoloration around mouth",
        "expected": "Emergency",
        "rationale": "Acute upper airway obstruction."
    },
    {
        "id": "RESP-03",
        "category": "Respiratory",
        "text": "Sudden sharp pleuritic chest pain with severe shortness of breath and coughing up bright red blood",
        "expected": "Emergency",
        "rationale": "Massive pulmonary embolism red flags."
    },

    # --- 3. NEUROLOGICAL (Ground Truth: Emergency) ---
    {
        "id": "NEUR-01",
        "category": "Neurological",
        "text": "Sudden onset right facial droop, right arm paralysis, and garbled incomprehensible speech",
        "expected": "Emergency",
        "rationale": "Acute ischemic stroke (FAST positive, time-critical tPA window)."
    },
    {
        "id": "NEUR-02",
        "category": "Neurological",
        "text": "Worst headache of my life, sudden thunderclap onset within seconds, vomiting and neck stiffness",
        "expected": "Emergency",
        "rationale": "Suspected Subarachnoid Hemorrhage (aneurysm rupture)."
    },
    {
        "id": "NEUR-03",
        "category": "Neurological",
        "text": "Patient is having generalized tonic-clonic convulsions lasting over 4 minutes without waking up",
        "expected": "Emergency",
        "rationale": "Status epilepticus."
    },
    {
        "id": "NEUR-04",
        "category": "Neurological",
        "text": "Sudden complete bilateral vision loss and acute confusion with left-sided hemiparesis",
        "expected": "Emergency",
        "rationale": "Basilar artery / posterior circulation stroke."
    },

    # --- 4. TRAUMA & BLEEDING (Ground Truth: Emergency) ---
    {
        "id": "TRAU-01",
        "category": "Trauma/Bleeding",
        "text": "Deep arterial puncture wound to the thigh, bright red blood spurting vigorously and will not stop with towels",
        "expected": "Emergency",
        "rationale": "Arterial hemorrhage risking rapid exsanguination."
    },
    {
        "id": "TRAU-02",
        "category": "Trauma/Bleeding",
        "text": "High speed motor vehicle collision, head hit steering wheel, unconscious with open skull depression",
        "expected": "Emergency",
        "rationale": "Major polytrauma / traumatic brain injury."
    },
    {
        "id": "TRAU-03",
        "category": "Trauma/Bleeding",
        "text": "Vomiting large quantities of dark coffee-ground blood and passing black tarry stools with extreme dizziness",
        "expected": "Emergency",
        "rationale": "Upper gastrointestinal bleeding with hemodynamic instability."
    },

    # --- 5. ANAPHYLAXIS & TOXICOLOGY (Ground Truth: Emergency) ---
    {
        "id": "ANAPH-01",
        "category": "Anaphylaxis",
        "text": "Accidentally consumed peanut sauce, throat closing, tongue swelling rapidly, full body hives, wheezing",
        "expected": "Emergency",
        "rationale": "Severe anaphylactic shock."
    },
    {
        "id": "ANAPH-02",
        "category": "Anaphylaxis",
        "text": "Multiple bee stings 10 minutes ago, feeling faint, BP dropping, lips blue, struggling to inhale air",
        "expected": "Emergency",
        "rationale": "Anaphylactic shock with airway compromise."
    },

    # --- 6. URGENT CASES: INFECTION, ACUTE PAIN, FRACTURES (Ground Truth: Urgent) ---
    {
        "id": "URG-01",
        "category": "Urgent/Infection",
        "text": "High fever of 103.5 F for two days with severe rigors, flank pain, burning urination and nausea",
        "expected": "Urgent",
        "rationale": "Acute pyelonephritis requiring urgent antibiotics and evaluation."
    },
    {
        "id": "URG-02",
        "category": "Urgent/GI",
        "text": "Severe right lower quadrant abdominal pain for 12 hours, low fever, pain worsened by walking",
        "expected": "Urgent",
        "rationale": "Acute appendicitis requiring urgent surgical evaluation."
    },
    {
        "id": "URG-03",
        "category": "Urgent/Ortho",
        "text": "Fell down steps, heard a loud pop in ankle, immediate severe swelling and inability to bear any weight",
        "expected": "Urgent",
        "rationale": "Acute ankle fracture / high-grade ligament tear requiring urgent radiography."
    },
    {
        "id": "URG-04",
        "category": "Urgent/GI",
        "text": "Severe gastrointestinal flu, vomited 8 times today, unable to tolerate sips of water, dry mouth and weakness",
        "expected": "Urgent",
        "rationale": "Dehydration secondary to acute gastroenteritis."
    },
    {
        "id": "URG-05",
        "category": "Urgent/Neuro",
        "text": "Severe throbbing migraine with aura and intense nausea lasting 18 hours, unresponsive to OTC ibuprofen",
        "expected": "Urgent",
        "rationale": "Status migrainosus requiring prescription abortive therapy."
    },
    {
        "id": "URG-06",
        "category": "Urgent/Skin",
        "text": "Punctured hand on rusty nail yesterday, now red streak spreading up forearm with throbbing warmth and pus",
        "expected": "Urgent",
        "rationale": "Ascending lymphangitis / cellulitis needing urgent antibiotics."
    },
    {
        "id": "URG-07",
        "category": "Urgent/ENT",
        "text": "Severe acute ear pain in 5-year-old with 102F fever and purulent drainage from ear canal",
        "expected": "Urgent",
        "rationale": "Acute suppurative otitis media with possible tympanic perforation."
    },
    {
        "id": "URG-08",
        "category": "Urgent/Ortho",
        "text": "Sharp sudden lower back spasm while lifting heavy box, pain shooting down sciatica nerve, can barely walk",
        "expected": "Urgent",
        "rationale": "Acute lumbar radiculopathy / severe disc herniation."
    },
    {
        "id": "URG-09",
        "category": "Urgent/Respiratory",
        "text": "Productive cough with rust-colored sputum, fever 102.8F, and moderate chest tightness for 3 days",
        "expected": "Urgent",
        "rationale": "Community-acquired pneumonia requiring urgent assessment and prescription."
    },
    {
        "id": "URG-10",
        "category": "Urgent/Wound",
        "text": "Deep laceration on palm from kitchen knife 2 hours ago, bleeding controlled with direct pressure but gaping open",
        "expected": "Urgent",
        "rationale": "Full-thickness laceration requiring suturing within primary closure window."
    },

    # --- 7. ROUTINE / PREVENTIVE / REFILL (Ground Truth: Routine) ---
    {
        "id": "ROUT-01",
        "category": "Routine/Refill",
        "text": "Need routine 90-day medication refill for my blood pressure pill Lisinopril 10mg, feeling completely fine",
        "expected": "Routine",
        "rationale": "Standard prescription refill request."
    },
    {
        "id": "ROUT-02",
        "category": "Routine/Refill",
        "text": "Requesting renewal of my daily Atorvastatin 20mg prescription for cholesterol management",
        "expected": "Routine",
        "rationale": "Routine chronic medication continuation."
    },
    {
        "id": "ROUT-03",
        "category": "Routine/Checkup",
        "text": "Scheduling my annual wellness physical exam and routine preventative blood panel",
        "expected": "Routine",
        "rationale": "Preventative routine care."
    },
    {
        "id": "ROUT-04",
        "category": "Routine/Followup",
        "text": "Routine follow up consultation to review my fasting glucose and lipid lab results from last week",
        "expected": "Routine",
        "rationale": "Non-urgent lab review."
    },
    {
        "id": "ROUT-05",
        "category": "Routine/MildIllness",
        "text": "Mild runny nose, sneezing, and slight tickle in throat for 2 days, drinking warm tea and resting",
        "expected": "Routine",
        "rationale": "Mild upper respiratory viral syndrome (common cold)."
    },
    {
        "id": "ROUT-06",
        "category": "Routine/MildIllness",
        "text": "Occasional mild dry cough in the morning for 3 days, no fever, no shortness of breath, normal energy",
        "expected": "Routine",
        "rationale": "Benign self-limited respiratory symptom."
    },
    {
        "id": "ROUT-07",
        "category": "Routine/Derm",
        "text": "Small dry itchy eczema patch on my elbow for past two weeks, would like a mild hydrocortisone recommendation",
        "expected": "Routine",
        "rationale": "Minor localized chronic dermatologic issue."
    },
    {
        "id": "ROUT-08",
        "category": "Routine/Allergy",
        "text": "Seasonal pollen allergies acting up with mild itchy watery eyes, need repeat antihistamine eye drops",
        "expected": "Routine",
        "rationale": "Mild allergic conjunctivitis."
    },
    {
        "id": "ROUT-09",
        "category": "Routine/Chronic",
        "text": "Mild ongoing knee stiffness after morning walks, diagnosed with mild osteoarthritis 2 years ago",
        "expected": "Routine",
        "rationale": "Stable chronic degenerative joint condition."
    },
    {
        "id": "ROUT-10",
        "category": "Routine/Admin",
        "text": "Need a doctor note for return to work after recovering from a mild stomach bug earlier this week",
        "expected": "Routine",
        "rationale": "Administrative clearance / return-to-work form."
    },

    # --- 8. SPELLING MISTAKES, TYPOS & SLANG ---
    {
        "id": "TYPO-01",
        "category": "Spelling/Emergency",
        "text": "chesst payne radiate to left arm cant breeth sweeting alot feal like dieng",
        "expected": "Emergency",
        "rationale": "Misspelled severe cardiac/respiratory emergency."
    },
    {
        "id": "TYPO-02",
        "category": "Spelling/Emergency",
        "text": "haevy bleedin spurting cant stop it loosing conciousnes",
        "expected": "Emergency",
        "rationale": "Misspelled arterial hemorrhage and syncope."
    },
    {
        "id": "TYPO-03",
        "category": "Spelling/Urgent",
        "text": "bad headacke throbbing cant sleep throwing up since yesturday night",
        "expected": "Urgent",
        "rationale": "Misspelled severe migraine with emesis."
    },
    {
        "id": "TYPO-04",
        "category": "Spelling/Urgent",
        "text": "sprained my ankel real bad swolen and bruized cant walk on it",
        "expected": "Urgent",
        "rationale": "Misspelled acute orthopedic trauma."
    },
    {
        "id": "TYPO-05",
        "category": "Spelling/Routine",
        "text": "need medecin refil for my presure pills ran out yestarday thanx",
        "expected": "Routine",
        "rationale": "Misspelled medication refill request."
    },
    {
        "id": "TYPO-06",
        "category": "Spelling/Routine",
        "text": "slite caugh and snotty nose fealing ok just need check",
        "expected": "Routine",
        "rationale": "Misspelled mild cold."
    },

    # --- 9. AMBIGUOUS & CONTEXT-DEPENDENT PHRASING ---
    {
        "id": "AMB-01",
        "category": "Ambiguous/Emergency",
        "text": "I feel very strange in my chest, heavy tightness and sudden cold sweat making me dizzy",
        "expected": "Emergency",
        "rationale": "Atypical presentation of cardiac ischemia with diaphoresis."
    },
    {
        "id": "AMB-02",
        "category": "Ambiguous/Emergency",
        "text": "My head feels funny and one side of my body feels completely numb and weak",
        "expected": "Emergency",
        "rationale": "Colloquial description of acute hemiparesis / stroke."
    },
    {
        "id": "AMB-03",
        "category": "Ambiguous/Urgent",
        "text": "Severe burning sensation when I pee and lower belly ache for past two days",
        "expected": "Urgent",
        "rationale": "Acute urinary tract infection / cystitis."
    },
    {
        "id": "AMB-04",
        "category": "Ambiguous/Routine",
        "text": "A little bit of blood when I blow my nose due to dry winter weather, no other problems",
        "expected": "Routine",
        "rationale": "Minor epistaxis from dry mucosal membranes, benign."
    },
    {
        "id": "AMB-05",
        "category": "Ambiguous/Routine",
        "text": "Feeling slightly tired after a busy work week and neck is a bit stiff from computer",
        "expected": "Routine",
        "rationale": "Ergonomic muscle fatigue, normal routine complaint."
    },

    # --- 10. EXACT FORMATTED STRINGS FROM PatientPortal.jsx ---
    # PatientPortal format: [Reported Symptoms: <items> | Duration: <duration>] <narrative>
    {
        "id": "PORTAL-01",
        "category": "PatientPortal/Emergency",
        "text": "[Reported Symptoms: Chest Pressure / Radiating Pain | Duration: Just started (< 2 hours)] Severe squeezing chest pressure radiating to left arm and jaw, sweating and nausea",
        "expected": "Emergency",
        "rationale": "Exact PatientPortal output for acute STEMI."
    },
    {
        "id": "PORTAL-02",
        "category": "PatientPortal/Emergency",
        "text": "[Reported Symptoms: Difficulty Breathing | Duration: Just started (< 2 hours)] Gasping for breath, inhaler not working, turning pale and dizzy",
        "expected": "Emergency",
        "rationale": "Exact PatientPortal output for acute respiratory failure."
    },
    {
        "id": "PORTAL-03",
        "category": "PatientPortal/Emergency",
        "text": "[Reported Symptoms: Slurred Speech / Facial Droop | Duration: Just started (< 2 hours)] Right side face is drooping, cannot lift arm, words coming out jumbled",
        "expected": "Emergency",
        "rationale": "Exact PatientPortal output for acute stroke."
    },
    {
        "id": "PORTAL-04",
        "category": "PatientPortal/Emergency",
        "text": "[Reported Symptoms: Uncontrolled Bleeding | Duration: Just started (< 2 hours)] Deep cut on arm spurting bright red blood, towels soaked through",
        "expected": "Emergency",
        "rationale": "Exact PatientPortal output for uncontrolled arterial hemorrhage."
    },
    {
        "id": "PORTAL-05",
        "category": "PatientPortal/Emergency",
        "text": "[Reported Symptoms: Chest Pressure / Radiating Pain, Difficulty Breathing | Duration: Just started (< 2 hours)] Patient presents with Chest Pressure / Radiating Pain, Difficulty Breathing experienced for Just started (< 2 hours).",
        "expected": "Emergency",
        "rationale": "Exact PatientPortal checkbox-only output for severe cardiopulmonary emergency."
    },
    {
        "id": "PORTAL-06",
        "category": "PatientPortal/Urgent",
        "text": "[Reported Symptoms: Severe Pain | Duration: Just started (< 2 hours)] 10/10 stabbing abdominal pain in lower right side, vomiting bile, cannot stand upright",
        "expected": "Urgent",
        "rationale": "Exact PatientPortal output for acute appendicitis."
    },
    {
        "id": "PORTAL-07",
        "category": "PatientPortal/Urgent",
        "text": "[Reported Symptoms: High Fever (>103°F) | Duration: 1–2 Days] High fever with rigors, painful flank pain and dark urine",
        "expected": "Urgent",
        "rationale": "Exact PatientPortal output for acute systemic infection."
    },
    {
        "id": "PORTAL-08",
        "category": "PatientPortal/Urgent",
        "text": "[Reported Symptoms: Persistent Vomiting | Duration: 1–2 Days] Cannot keep liquids down for 24 hours, dizzy when standing up",
        "expected": "Urgent",
        "rationale": "Exact PatientPortal output for dehydration."
    },
    {
        "id": "PORTAL-09",
        "category": "PatientPortal/Urgent",
        "text": "[Reported Symptoms: Severe Headache / Migraine | Duration: 3–7 Days] Throbbing unilateral headache with photophobia and nausea",
        "expected": "Urgent",
        "rationale": "Exact PatientPortal output for migraine."
    },
    {
        "id": "PORTAL-10",
        "category": "PatientPortal/Urgent",
        "text": "[Reported Symptoms: Sprain / Suspected Fracture | Duration: 1–2 Days] Fell on ice, wrist is visibly deformed and swollen, cannot move fingers",
        "expected": "Urgent",
        "rationale": "Exact PatientPortal output for displaced fracture."
    },
    {
        "id": "PORTAL-11",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Mild Cough / Runny Nose | Duration: 1–2 Days] Patient presents with Mild Cough / Runny Nose experienced for 1–2 Days.",
        "expected": "Routine",
        "rationale": "Exact PatientPortal checkbox-only output for mild cold."
    },
    {
        "id": "PORTAL-12",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Mild Cough / Runny Nose | Duration: 3–7 Days] Mild congestion, clear mucus, slight tickle in throat, feeling fine otherwise",
        "expected": "Routine",
        "rationale": "Exact PatientPortal output for mild viral cold."
    },
    {
        "id": "PORTAL-13",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Sore Throat / Congestion | Duration: 1–2 Days] Mild pharyngitis, drinking tea, no fever or trouble swallowing",
        "expected": "Routine",
        "rationale": "Exact PatientPortal output for minor sore throat."
    },
    {
        "id": "PORTAL-14",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Minor Skin Rash / Allergy | Duration: > 1 Week] Small itchy dry eczema patch on inner elbow, need cream refill",
        "expected": "Routine",
        "rationale": "Exact PatientPortal output for minor rash."
    },
    {
        "id": "PORTAL-15",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Routine Prescription Refill | Duration: > 1 Week] Patient presents with Routine Prescription Refill experienced for > 1 Week.",
        "expected": "Routine",
        "rationale": "Exact PatientPortal checkbox-only output for refill."
    },
    {
        "id": "PORTAL-16",
        "category": "PatientPortal/Routine",
        "text": "[Reported Symptoms: Routine Prescription Refill | Duration: > 1 Week] Need 90-day refill of lisinopril 10mg, asymptomatic and well",
        "expected": "Routine",
        "rationale": "Exact PatientPortal output for maintenance refill."
    },

    # --- 11. EDGE CASES & DANGEROUS UNDER-TRIAGE RISKS ---
    {
        "id": "EDGE-01",
        "category": "EdgeCase/Emergency",
        "text": "Severe pressure across chest radiating to left jaw, but mild nausea",
        "expected": "Emergency",
        "rationale": "Contains the word 'mild' which might trigger Routine classifier despite severe chest pressure."
    },
    {
        "id": "EDGE-02",
        "category": "EdgeCase/Emergency",
        "text": "Sudden slurred speech and facial drooping, but no severe pain",
        "expected": "Emergency",
        "rationale": "Painless acute stroke presentation."
    },
    {
        "id": "EDGE-03",
        "category": "EdgeCase/Emergency",
        "text": "Difficulty breathing, coughing up foam, heart failure history",
        "expected": "Emergency",
        "rationale": "Acute pulmonary edema."
    },
    {
        "id": "EDGE-04",
        "category": "EdgeCase/Routine",
        "text": "Need routine prescription renewal for my chronic severe asthma inhaler, currently having zero symptoms",
        "expected": "Routine",
        "rationale": "Contains words 'severe' and 'asthma' but clearly states routine refill with zero symptoms."
    },
    {
        "id": "EDGE-05",
        "category": "EdgeCase/Routine",
        "text": "Regular blood pressure checkup, previous history of heart condition but feeling completely normal today",
        "expected": "Routine",
        "rationale": "Contains 'heart condition' but is a routine follow-up with normal status."
    },

    # --- 12. NEGATION & PAST MEDICAL HISTORY EDGE CASES ---
    {
        "id": "NEG-01",
        "category": "Negation/Routine",
        "text": "No chest pain, no shortness of breath, just need a checkup",
        "expected": "Routine",
        "rationale": "Explicit negation of cardiac symptoms in routine checkup."
    },
    {
        "id": "NEG-02",
        "category": "Negation/Routine",
        "text": "No fever, no severe pain, mild cold symptoms",
        "expected": "Routine",
        "rationale": "Explicit negation of high acuity symptoms in mild viral illness."
    },
    {
        "id": "NEG-03",
        "category": "Negation/Routine",
        "text": "Small itchy dry patch on my elbow for a few days, no fever or pain.",
        "expected": "Routine",
        "rationale": "Minor skin patch explicitly denying fever or pain."
    },
    {
        "id": "NEG-04",
        "category": "Negation/Routine",
        "text": "Need a refill for my blood pressure pills, I do not have severe pain or fever",
        "expected": "Routine",
        "rationale": "Standard refill denying pain or fever."
    },
    {
        "id": "NEG-05",
        "category": "Negation/Routine",
        "text": "Worried about heart attack risk in the future, currently asymptomatic and feel fine",
        "expected": "Routine",
        "rationale": "Preventative inquiry with explicitly asymptomatic status."
    },
    {
        "id": "NEG-06",
        "category": "Negation/Routine",
        "text": "Fell down last week, no more pain, just need a checkup",
        "expected": "Routine",
        "rationale": "Resolved past injury requiring routine post-recovery review."
    },
    {
        "id": "NEG-07",
        "category": "Negation/Routine",
        "text": "Sprained ankle 3 weeks ago, pain is completely gone, need clearance note",
        "expected": "Routine",
        "rationale": "Resolved orthopedic issue requesting return-to-activity clearance."
    },
    {
        "id": "NEG-08",
        "category": "Negation/Routine",
        "text": "History of asthma, need standard inhaler refill, breathing is completely normal",
        "expected": "Routine",
        "rationale": "Chronic condition maintenance with normal current breathing."
    }
]


def run_evaluation():
    model_path = os.path.join(backend_dir, "ml", "triage_model.pkl")
    if not os.path.exists(model_path):
        print(f"ERROR: Model file not found at {model_path}")
        return

    print(f"Loading triage model from {model_path}...")
    model = joblib.load(model_path)
    print(f"Loaded successfully. Classes: {model.classes_}")

    print(f"\nTotal test cases: {len(TEST_CASES)}")
    categories = {}
    for tc in TEST_CASES:
        categories[tc["expected"]] = categories.get(tc["expected"], 0) + 1
    print(f"Distribution: {categories}")

    # Run for both Mode A (Live backend) and Mode B (Preprocessed)
    for mode_name, use_preprocess in [("MODE A: Live Backend Inference (model.predict([raw_text]))", False),
                                      ("MODE B: Preprocessed Inference (model.predict([preprocess(raw_text)]))", True)]:
        print("\n" + "=" * 80)
        print(f"EVALUATING {mode_name}")
        print("=" * 80)

        y_true = []
        y_pred = []
        results = []

        for tc in TEST_CASES:
            raw_text = tc["text"]
            if use_preprocess:
                input_str = preprocess_text(raw_text)
            else:
                input_str = raw_text

            pred_class = model.predict([input_str])[0]
            
            # Predict probabilities if available
            proba_dict = {}
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba([input_str])[0]
                proba_dict = {cls: round(float(p), 4) for cls, p in zip(model.classes_, probs)}

            y_true.append(tc["expected"])
            y_pred.append(pred_class)

            is_correct = (pred_class == tc["expected"])
            results.append({
                "id": tc["id"],
                "category": tc["category"],
                "text": raw_text,
                "input_to_model": input_str,
                "expected": tc["expected"],
                "predicted": pred_class,
                "probabilities": proba_dict,
                "is_correct": is_correct,
                "rationale": tc["rationale"]
            })

        acc = accuracy_score(y_true, y_pred)
        labels = ["Emergency", "Urgent", "Routine"]
        cm = confusion_matrix(y_true, y_pred, labels=labels)
        report = classification_report(y_true, y_pred, labels=labels, output_dict=True)

        print(f"\nOverall Accuracy: {acc * 100:.2f}% ({sum(1 for r in results if r['is_correct'])} / {len(results)})")
        print("\nConfusion Matrix (Rows = Ground Truth, Columns = Predicted):")
        print(f"Labels: {labels}")
        print(pd.DataFrame(cm, index=[f"True_{l}" for l in labels], columns=[f"Pred_{l}" for l in labels]))

        print("\nClassification Report:")
        print(classification_report(y_true, y_pred, labels=labels))

        # Critical Safety Analysis
        # Emergency False Negatives: True = Emergency, Pred != Emergency
        emergencies = [r for r in results if r["expected"] == "Emergency"]
        emergency_fn = [r for r in emergencies if r["predicted"] != "Emergency"]
        emergency_fn_rate = (len(emergency_fn) / len(emergencies)) * 100 if emergencies else 0.0

        print(f"\nCRITICAL SAFETY METRIC - Emergency Under-Triage (False Negative Rate):")
        print(f"Total Emergency Cases: {len(emergencies)}")
        print(f"Emergency Missed (Classified as Urgent or Routine): {len(emergency_fn)}")
        print(f"Emergency False Negative Rate: {emergency_fn_rate:.2f}%")

        # Over-triage / Misclassification Breakdowns
        # 1. Emergency predicted as Routine or Urgent
        # 2. Routine predicted as Urgent or Emergency
        # 3. Urgent predicted as Routine or Emergency
        emerg_as_routine = [r for r in emergency_fn if r["predicted"] == "Routine"]
        emerg_as_urgent = [r for r in emergency_fn if r["predicted"] == "Urgent"]

        routines = [r for r in results if r["expected"] == "Routine"]
        routine_as_urgent = [r for r in routines if r["predicted"] == "Urgent"]
        routine_as_emerg = [r for r in routines if r["predicted"] == "Emergency"]

        urgents = [r for r in results if r["expected"] == "Urgent"]
        urgent_as_routine = [r for r in urgents if r["predicted"] == "Routine"]
        urgent_as_emerg = [r for r in urgents if r["predicted"] == "Emergency"]

        print(f"\nDetailed Error Breakdown:")
        print(f"  - Emergency predicted as Routine (FATAL SAFETY RISK): {len(emerg_as_routine)}")
        print(f"  - Emergency predicted as Urgent (DELAYED ESCALATION RISK): {len(emerg_as_urgent)}")
        print(f"  - Urgent predicted as Routine (DANGEROUS UNDER-TRIAGE): {len(urgent_as_routine)}")
        print(f"  - Urgent predicted as Emergency (OVER-TRIAGE / PREEMPTION): {len(urgent_as_emerg)}")
        print(f"  - Routine predicted as Urgent (OVER-TRIAGE / CLINICAL BURDEN): {len(routine_as_urgent)}")
        print(f"  - Routine predicted as Emergency (FALSE ALARM PREEMPTION): {len(routine_as_emerg)}")

        failures = [r for r in results if not r["is_correct"]]
        print(f"\nTotal Failures: {len(failures)} / {len(results)}")
        if failures:
            print("\nList of Failing Test Cases:")
            for f in failures:
                print(f"  [{f['id']}] Expected: {f['expected']:<9} | Predicted: {f['predicted']:<9} | Probs: {f['probabilities']}")
                print(f"    Text: {f['text']}")
                if use_preprocess:
                    print(f"    Tokens: {f['input_to_model']}")
                print()

        # Save results to a json file for easy reference
        filename = "test_results_live_inference.json" if not use_preprocess else "test_results_preprocessed.json"
        out_path = os.path.join(backend_dir, "tests", filename)
        with open(out_path, "w", encoding="utf-8") as out_f:
            json.dump({
                "mode": mode_name,
                "total_cases": len(results),
                "accuracy": acc,
                "emergency_fn_rate": emergency_fn_rate,
                "confusion_matrix": cm.tolist(),
                "report": report,
                "failures": failures,
                "all_results": results
            }, out_f, indent=2)
        print(f"Saved results to {out_path}")


if __name__ == "__main__":
    run_evaluation()
