"""
Verification script: Validates backend/main.py Hybrid Clinical Triage Engine
specifically focusing on the 16 failed cases from board post #15 and all 76 clinical cases.
"""
import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import main as main_app
from tests.test_ai_triage_comprehensive import TEST_CASES

# The 16 specific failed cases from #15
FAILED_CASES_FROM_15 = [
    # A. Emergency predicted as Routine (Fatal Under-Triage)
    {
        "id": "NEUR-02",
        "expected": "Emergency",
        "text": "Worst headache of my life, sudden thunderclap onset within seconds, vomiting and neck stiffness"
    },
    {
        "id": "NEUR-03",
        "expected": "Emergency",
        "text": "Patient is having generalized tonic-clonic convulsions lasting over 4 minutes without waking up"
    },
    {
        "id": "TRAU-03",
        "expected": "Emergency",
        "text": "Vomiting large quantities of dark coffee-ground blood and passing black tarry stools with extreme dizziness"
    },

    # B. Emergency predicted as Urgent (Delayed Escalation)
    {
        "id": "TRAU-02",
        "expected": "Emergency",
        "text": "High speed motor vehicle collision, head hit steering wheel, unconscious with open skull depression"
    },
    {
        "id": "ANAPH-01",
        "expected": "Emergency",
        "text": "Accidentally consumed peanut sauce, throat closing, tongue swelling rapidly, full body hives, wheezing"
    },
    {
        "id": "PORTAL-04",
        "expected": "Emergency",
        "text": "[Reported Symptoms: Uncontrolled Bleeding | Duration: Just started (< 2 hours)] Deep cut on arm spurting bright red blood, towels soaked through"
    },

    # C. Urgent predicted as Routine (Under-Triage)
    {
        "id": "URG-06",
        "expected": "Urgent",
        "text": "Punctured hand on rusty nail yesterday, now red streak spreading up forearm with throbbing warmth and pus"
    },

    # D. Urgent predicted as Emergency (Unnecessary Preemption)
    {
        "id": "URG-08",
        "expected": "Urgent",
        "text": "Sharp sudden lower back spasm while lifting heavy box, pain shooting down sciatica nerve, can barely walk"
    },
    {
        "id": "URG-10",
        "expected": "Urgent",
        "text": "Deep laceration on palm from kitchen knife 2 hours ago, bleeding controlled with direct pressure but gaping open"
    },

    # E. Routine predicted as Emergency (False Alarm Preemption via Negation)
    {
        "id": "NEG-01",
        "expected": "Routine",
        "text": "No chest pain, no shortness of breath, just need a checkup"
    },
    {
        "id": "NEG-04",
        "expected": "Routine",
        "text": "Need a refill for my blood pressure pills, I do not have severe pain or fever"
    },
    {
        "id": "NEG-05",
        "expected": "Routine",
        "text": "Worried about heart attack risk in the future, currently asymptomatic and feel fine"
    },

    # F. Routine predicted as Urgent (Over-triage)
    {
        "id": "NEG-02",
        "expected": "Routine",
        "text": "No fever, no severe pain, mild cold symptoms"
    },
    {
        "id": "NEG-03",
        "expected": "Routine",
        "text": "Small itchy dry patch on my elbow for a few days, no fever or pain."
    },
    {
        "id": "NEG-06",
        "expected": "Routine",
        "text": "Fell down last week, no more pain, just need a checkup"
    },
    {
        "id": "NEG-07",
        "expected": "Routine",
        "text": "Sprained ankle 3 weeks ago, pain is completely gone, need clearance note"
    }
]


def test_16_failed_cases():
    print("=" * 80)
    print("TESTING 16 CRITICAL FAILED CASES FROM #15 USING backend/main.py ENGINE")
    print("=" * 80)
    all_passed = True
    for item in FAILED_CASES_FROM_15:
        urgency, kws, source, conf = main_app.hybrid_clinical_triage(item["text"])
        passed = (urgency == item["expected"])
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"[{status}] {item['id']:<10} Expected: {item['expected']:<10} | Actual: {urgency:<10} | Source: {source}")
        print(f"       Flags: {kws}")
        print(f"       Text: {item['text'][:75]}...")
    
    print("\n16 Cases Result:", "ALL 16 PASSED!" if all_passed else "SOME FAILED")
    return all_passed


def test_all_76_cases():
    print("\n" + "=" * 80)
    print("TESTING ALL 76 CLINICAL BENCHMARK CASES USING backend/main.py ENGINE")
    print("=" * 80)
    correct = 0
    failures = []
    for tc in TEST_CASES:
        urgency, kws, source, conf = main_app.hybrid_clinical_triage(tc["text"])
        if urgency == tc["expected"]:
            correct += 1
        else:
            failures.append({
                "id": tc["id"],
                "expected": tc["expected"],
                "actual": urgency,
                "source": source,
                "text": tc["text"]
            })
    
    print(f"Total: {correct} / {len(TEST_CASES)} passed ({correct / len(TEST_CASES) * 100:.2f}%)")
    if failures:
        print("Failures:")
        for f in failures:
            print(f"  [{f['id']}] Expected: {f['expected']} | Actual: {f['actual']} | Source: {f['source']}")
    else:
        print("PERFECT 100% (76/76) ON ALL CLINICAL CASES!")
    return len(failures) == 0


if __name__ == "__main__":
    res16 = test_16_failed_cases()
    res76 = test_all_76_cases()
    if res16 and res76:
        print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        sys.exit(1)
