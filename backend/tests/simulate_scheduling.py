import itertools
import json
import os
import random
from datetime import datetime, timedelta
import joblib
import numpy as np

from backend.main import CalendarManager


def simulate_fifo(arrivals):
    """Baseline FIFO scheduler: assigns next available 30-min business-hour slot in arrival order."""
    occupied = set()
    records = []
    for patient in arrivals:
        slot = CalendarManager._round_to_slot(patient["arrival_time"] + timedelta(minutes=30))
        while True:
            slot = CalendarManager._enforce_business_hours(slot)
            if slot not in occupied:
                occupied.add(slot)
                break
            slot += timedelta(minutes=30)
        wait_hours = (slot - patient["arrival_time"]).total_seconds() / 3600.0
        records.append({
            "id": patient["id"],
            "urgency": patient["urgency"],
            "wait_hours": wait_hours,
        })
    return records


def simulate_priority_preemption(arrivals):
    """Mirrors CalendarManager.get_next_available_slot and preempt_for_emergency rules."""
    appointments = []  # dicts with id, urgency, arrival_time, scheduled_time, status
    occupied = set()
    preemption_count = 0

    def next_free(start_dt):
        dt = CalendarManager._round_to_slot(start_dt)
        while True:
            dt = CalendarManager._enforce_business_hours(dt)
            if dt not in occupied:
                return dt
            dt += timedelta(minutes=30)

    for patient in arrivals:
        now = patient["arrival_time"]
        urg = patient["urgency"]

        if urg == "Emergency":
            # Find earliest future Pending Routine/Urgent appointment
            candidates = [
                a for a in appointments
                if a["urgency"] in ("Routine", "Urgent")
                and a["status"] == "Pending"
                and a["scheduled_time"] >= now
            ]
            if candidates:
                bumped = min(candidates, key=lambda a: a["scheduled_time"])
                stolen_time = bumped["scheduled_time"]
                occupied.discard(stolen_time)
                new_slot = next_free(stolen_time + timedelta(minutes=30))
                occupied.add(new_slot)
                bumped["scheduled_time"] = new_slot
                bumped["preempted"] = True
                scheduled_time = stolen_time
                occupied.add(scheduled_time)
                preemption_count += 1
            else:
                scheduled_time = next_free(now + timedelta(minutes=30))
                occupied.add(scheduled_time)
        elif urg == "Urgent":
            scheduled_time = next_free(now + timedelta(days=1, hours=2))
            occupied.add(scheduled_time)
        else:
            scheduled_time = next_free(now + timedelta(days=3, hours=4))
            occupied.add(scheduled_time)

        appointments.append({
            "id": patient["id"],
            "urgency": urg,
            "arrival_time": now,
            "scheduled_time": scheduled_time,
            "status": "Pending",
            "preempted": False,
        })

    records = [
        {
            "id": a["id"],
            "urgency": a["urgency"],
            "wait_hours": (a["scheduled_time"] - a["arrival_time"]).total_seconds() / 3600.0,
        }
        for a in appointments
    ]
    return records, preemption_count


def summarize(records):
    by_class = {}
    for cls in ["Emergency", "Urgent", "Routine"]:
        vals = [r["wait_hours"] for r in records if r["urgency"] == cls]
        by_class[cls] = {
            "count": len(vals),
            "mean_wait_hours": round(float(np.mean(vals)), 2),
            "median_wait_hours": round(float(np.median(vals)), 2),
            "max_wait_hours": round(float(np.max(vals)), 2),
        }
    all_vals = [r["wait_hours"] for r in records]
    by_class["Overall"] = {
        "count": len(all_vals),
        "mean_wait_hours": round(float(np.mean(all_vals)), 2),
    }
    return by_class


def extract_top_svm_features(top_n: int = 10):
    """Per-class token weights from the linear SVM coefficients.

    scikit-learn's SVC is one-vs-one: each class pair (i, j) has one coefficient vector where a
    positive decision value votes for class i. A token's weight for class c is the sum of the
    signed coefficients over the pairs containing c, averaged over the calibration folds.
    """
    model_path = os.path.join(os.path.dirname(__file__), "..", "ml", "triage_model.pkl")
    model = joblib.load(model_path)
    vocab = model.named_steps["tfidf"].get_feature_names_out()
    clf = model.named_steps["clf"]
    classes = list(clf.classes_)
    pairs = list(itertools.combinations(range(len(classes)), 2))

    weights = np.zeros((len(classes), len(vocab)))
    for calibrated in clf.calibrated_classifiers_:
        coef = calibrated.estimator.coef_
        coef = coef.toarray() if hasattr(coef, "toarray") else np.asarray(coef)
        for k, (i, j) in enumerate(pairs):
            weights[i] += coef[k]
            weights[j] -= coef[k]
    weights /= len(clf.calibrated_classifiers_)

    top_features = {}
    for idx, cls in enumerate(classes):
        order = np.argsort(weights[idx])[::-1][:top_n]
        top_features[cls] = [{"token": str(vocab[i]), "weight": round(float(weights[idx][i]), 3)} for i in order]
    return top_features


def run_simulation(num_patients: int = 100, seed: int = 42):
    rng = random.Random(seed)
    # 15% Emergency, 30% Urgent, 55% Routine arriving over 2 clinic business days (09:00-17:00 UTC)
    urgencies = ["Emergency"] * 15 + ["Urgent"] * 30 + ["Routine"] * 55
    rng.shuffle(urgencies)

    base_day = datetime(2026, 11, 23, 9, 0)  # Monday 09:00 UTC
    arrivals = []
    for i, urg in enumerate(urgencies):
        # Spread 50 patients per day across 8 hours (~9.6 min apart)
        day_offset = i // 50
        minute_offset = (i % 50) * 9 + rng.randint(0, 5)
        arr_time = base_day + timedelta(days=day_offset, minutes=minute_offset)
        arrivals.append({"id": i + 1, "urgency": urg, "arrival_time": arr_time})

    fifo_records = simulate_fifo(arrivals)
    prio_records, preemptions = simulate_priority_preemption(arrivals)

    fifo_summary = summarize(fifo_records)
    prio_summary = summarize(prio_records)

    emerg_reduction = (
        (fifo_summary["Emergency"]["mean_wait_hours"] - prio_summary["Emergency"]["mean_wait_hours"])
        / fifo_summary["Emergency"]["mean_wait_hours"]
        * 100.0
    )

    sim_out = {
        "num_patients": num_patients,
        "class_mix": {"Emergency": 15, "Urgent": 30, "Routine": 55},
        "assumptions": {
            "seed": seed,
            "first_arrival_utc": base_day.isoformat(),
            "business_days_of_arrivals": 2,
            "arrivals_per_business_day": 50,
            "slot_minutes": 30,
            "business_hours_utc": "09:00-17:00",
            "slots_per_day": 16,
            "weekends_skipped": False,
            "baseline": "FIFO: next free slot from 30 minutes after submission for every patient",
            "policy": "CalendarManager rules: Urgent from +26 h, Routine from +76 h, Emergency preempts earliest pending Routine/Urgent slot",
        },
        "preemptions_triggered": preemptions,
        "fifo_baseline": fifo_summary,
        "priority_preemption": prio_summary,
        "emergency_wait_reduction_pct": round(float(emerg_reduction), 2),
    }

    sim_path = os.path.join(os.path.dirname(__file__), "scheduling_simulation_results.json")
    with open(sim_path, "w", encoding="utf-8") as f:
        json.dump(sim_out, f, indent=2)

    feat_out = extract_top_svm_features()
    feat_path = os.path.join(os.path.dirname(__file__), "..", "ml", "svm_top_features.json")
    with open(feat_path, "w", encoding="utf-8") as f:
        json.dump(feat_out, f, indent=2)

    print("Simulation saved to", sim_path)
    print(json.dumps(sim_out, indent=2))
    print("Top SVM features saved to", feat_path)


if __name__ == "__main__":
    run_simulation()
