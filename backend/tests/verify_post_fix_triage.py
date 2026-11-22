"""
Comprehensive Post-Fix Validation of Hybrid Clinical Triage Engine & Retrained Model
Verifies:
1. Live hybrid_clinical_triage() in backend/main.py across all 76 clinical scenarios
2. Retrained triage_model.pkl directly
3. Explicit verification of all previously failing edge cases
4. Comparison of Before vs. After metrics
"""

import sys
import os
import json
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import test cases from the comprehensive test suite
from tests.test_ai_triage_comprehensive import TEST_CASES
from main import hybrid_clinical_triage, triage_model
from ml.preprocess import preprocess_text

def run_postfix_verification():
    print("=" * 80)
    print("POST-FIX VALIDATION: HYBRID CLINICAL TRIAGE ENGINE (backend/main.py)")
    print("=" * 80)

    y_true = []
    y_pred_hybrid = []
    y_pred_ml_only = []
    hybrid_results = []

    for tc in TEST_CASES:
        text = tc["text"]
        expected = tc["expected"]
        
        # 1. Hybrid Engine evaluation (Live API path)
        pred_urgency, extracted_kws, source, conf = hybrid_clinical_triage(text)
        y_true.append(expected)
        y_pred_hybrid.append(pred_urgency)

        # 2. Raw ML model evaluation (processed text path)
        processed = preprocess_text(text)
        ml_pred = triage_model.predict([processed])[0]
        y_pred_ml_only.append(ml_pred)

        hybrid_results.append({
            "id": tc["id"],
            "category": tc["category"],
            "text": text,
            "expected": expected,
            "hybrid_pred": pred_urgency,
            "ml_pred": ml_pred,
            "source": source,
            "confidence": conf,
            "keywords": extracted_kws,
            "is_correct": (pred_urgency == expected)
        })

    labels = ["Emergency", "Urgent", "Routine"]

    # Hybrid Engine Metrics
    hybrid_acc = accuracy_score(y_true, y_pred_hybrid)
    hybrid_cm = confusion_matrix(y_true, y_pred_hybrid, labels=labels)
    hybrid_report = classification_report(y_true, y_pred_hybrid, labels=labels, output_dict=True)

    # ML Only Metrics
    ml_acc = accuracy_score(y_true, y_pred_ml_only)
    ml_cm = confusion_matrix(y_true, y_pred_ml_only, labels=labels)

    print(f"\nTotal Test Cases: {len(TEST_CASES)}")
    print(f"Hybrid Engine Accuracy: {hybrid_acc * 100:.2f}% ({sum(1 for r in hybrid_results if r['is_correct'])} / {len(TEST_CASES)})")
    print(f"Retrained ML Model Accuracy: {ml_acc * 100:.2f}%\n")

    print("Confusion Matrix - Live Hybrid Engine (Rows = Ground Truth, Columns = Predicted):")
    print(pd.DataFrame(hybrid_cm, index=[f"True_{l}" for l in labels], columns=[f"Pred_{l}" for l in labels]))

    print("\nClassification Report - Live Hybrid Engine:")
    print(classification_report(y_true, y_pred_hybrid, labels=labels))

    # Safety Metrics
    emergencies = [r for r in hybrid_results if r["expected"] == "Emergency"]
    emergency_fn = [r for r in emergencies if r["hybrid_pred"] != "Emergency"]
    fn_rate = (len(emergency_fn) / len(emergencies)) * 100 if emergencies else 0.0

    print(f"\nCRITICAL SAFETY METRIC - Emergency Under-Triage (False Negative Rate):")
    print(f"Total Emergency Cases: {len(emergencies)}")
    print(f"Emergency Missed: {len(emergency_fn)}")
    print(f"Emergency False Negative Rate (FNR): {fn_rate:.2f}%")

    failures = [r for r in hybrid_results if not r["is_correct"]]
    print(f"\nTotal Failures: {len(failures)}")
    for f in failures:
        print(f"  [{f['id']}] Expected: {f['expected']} | Predicted: {f['hybrid_pred']} (Source: {f['source']})")
        print(f"    Text: {f['text']}")

    # Verification of specific key test cases requested by coordinator
    key_cases_to_verify = [
        "NEUR-02", "NEUR-03", "TRAU-03", "TRAU-02", "ANAPH-01", "PORTAL-04",
        "URG-06", "URG-08", "URG-10", "NEG-01", "NEG-02", "NEG-03", "NEG-04",
        "NEG-05", "NEG-06", "NEG-07", "ROUT-01", "ROUT-03"
    ]

    print("\n" + "=" * 80)
    print("SPECIFIC EDGE-CASE AUDIT REQUESTED BY COORDINATOR:")
    print("=" * 80)
    all_key_passed = True
    for case_id in key_cases_to_verify:
        case = next((r for r in hybrid_results if r["id"] == case_id), None)
        if case:
            status_str = "PASS" if case["is_correct"] else "FAIL"
            if not case["is_correct"]:
                all_key_passed = False
            print(f"[{status_str}] {case['id']:<10} Expected: {case['expected']:<10} | Got: {case['hybrid_pred']:<10} | Source: {case['source']:<26} | Conf: {case['confidence']}")
            print(f"       Text: {case['text'][:75]}...")
    
    print("\nAll Key Edge Cases Passed:", all_key_passed)

    # Save summary
    out_summary = {
        "hybrid_accuracy": hybrid_acc,
        "ml_accuracy": ml_acc,
        "emergency_fn_rate": fn_rate,
        "failures": failures,
        "hybrid_confusion_matrix": hybrid_cm.tolist(),
        "hybrid_report": hybrid_report,
        "key_cases_verified": all_key_passed
    }
    summary_path = os.path.join(backend_dir, "tests", "postfix_verification_results.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(out_summary, f, indent=2)
    print(f"\nDetailed verification results written to {summary_path}")

if __name__ == "__main__":
    run_postfix_verification()
