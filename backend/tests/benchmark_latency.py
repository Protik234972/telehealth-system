import json
import os
import statistics
import time
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.ml.preprocess import preprocess_text
from backend.tests.test_app import FakeDB

SAMPLE_TEXTS = [
    "I need a routine blood pressure follow up appointment and prescription refill.",
    "Head hurts rly bad cant sleep coughing alot feeling terrible since yesterday.",
    "I am experiencing severe crushing chest pain coming down my left arm and difficulty breathing.",
]


def run_benchmark(num_requests: int = 100):
    fake_db = FakeDB()
    orig_db = main_module.db
    orig_smtp = (main_module.SMTP_EMAIL, main_module.SMTP_PASSWORD)
    main_module.db = fake_db
    main_module.SMTP_EMAIL = ""
    main_module.SMTP_PASSWORD = ""

    spacy_times_ms = []
    tfidf_svm_times_ms = []
    endpoint_times_ms = []

    try:
        client = TestClient(main_module.app)
        client.post(
            "/register",
            json={
                "username": "bench_user",
                "password": "password123",
                "email": "bench@example.com",
                "mobile": "+60123456789",
            },
        )
        token = client.post(
            "/login", data={"username": "bench_user", "password": "password123"}
        ).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Warm up once
        preprocess_text(SAMPLE_TEXTS[0])
        main_module.triage_model.predict(["routine follow up"])

        for i in range(num_requests):
            txt = SAMPLE_TEXTS[i % len(SAMPLE_TEXTS)]

            t0 = time.perf_counter()
            prep = preprocess_text(txt)
            t1 = time.perf_counter()
            main_module.triage_model.predict([prep])
            t2 = time.perf_counter()

            spacy_times_ms.append((t1 - t0) * 1000.0)
            tfidf_svm_times_ms.append((t2 - t1) * 1000.0)

            r0 = time.perf_counter()
            res = client.post(
                "/submit-symptoms",
                json={
                    "patient_name": f"Bench Patient {i}",
                    "contact_info": "bench@example.com",
                    "symptom_text": txt,
                },
                headers=headers,
            )
            r1 = time.perf_counter()
            if res.status_code != 200:
                raise RuntimeError(f"Benchmark request failed: {res.status_code} {res.text}")
            endpoint_times_ms.append((r1 - r0) * 1000.0)
    finally:
        main_module.db = orig_db
        main_module.SMTP_EMAIL, main_module.SMTP_PASSWORD = orig_smtp

    summary = {
        "num_requests": num_requests,
        "environment": "Local FastAPI TestClient with in-memory FakeDB (excludes MongoDB Atlas network RTT)",
        "spacy_preprocess_ms": {
            "mean": round(statistics.mean(spacy_times_ms), 3),
            "p95": round(sorted(spacy_times_ms)[int(0.95 * num_requests) - 1], 3),
            "max": round(max(spacy_times_ms), 3),
        },
        "tfidf_calibrated_svm_ms": {
            "mean": round(statistics.mean(tfidf_svm_times_ms), 3),
            "p95": round(sorted(tfidf_svm_times_ms)[int(0.95 * num_requests) - 1], 3),
            "max": round(max(tfidf_svm_times_ms), 3),
        },
        "end_to_end_local_api_ms": {
            "mean": round(statistics.mean(endpoint_times_ms), 3),
            "p95": round(sorted(endpoint_times_ms)[int(0.95 * num_requests) - 1], 3),
            "max": round(max(endpoint_times_ms), 3),
        },
    }

    out_path = os.path.join(os.path.dirname(__file__), "benchmark_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    run_benchmark()
