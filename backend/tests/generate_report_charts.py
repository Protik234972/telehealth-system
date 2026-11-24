"""Chapter 5 charts for the FYP report, drawn at final print size (5.7 in wide).

All numbers are read from the JSON artifacts produced by the evaluation, benchmark and
simulation scripts, so the figures cannot drift from the measured results:

    backend/ml/evaluation_results.json
    backend/ml/svm_top_features.json
    backend/tests/benchmark_results.json
    backend/tests/scheduling_simulation_results.json

Run from the repository root:  python backend/tests/generate_report_charts.py
"""
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(BASE_DIR, "report_charts")
os.makedirs(OUT_DIR, exist_ok=True)


def _pick(candidates, fallback):
    names = {f.name for f in font_manager.fontManager.ttflist}
    for name in candidates:
        if name in names:
            return name
    return fallback


plt.rcParams.update({
    "font.family": _pick(["Arial", "Calibri"], "DejaVu Sans"),
    "font.size": 7,
    "axes.titlesize": 7.6,
    "axes.titleweight": "bold",
    "axes.labelsize": 7,
    "xtick.labelsize": 6.6,
    "ytick.labelsize": 6.6,
    "legend.fontsize": 6.4,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 300,
})

BLUE, RED, GREEN, AMBER, SLATE, PURPLE = "#2563eb", "#dc2626", "#16a34a", "#d97706", "#64748b", "#7c3aed"
LABELS = ["Emergency", "Urgent", "Routine"]
CLASS_COLOR = {"Emergency": RED, "Urgent": AMBER, "Routine": GREEN}


def load_json(rel_path):
    with open(os.path.join(BASE_DIR, rel_path), "r", encoding="utf-8") as f:
        return json.load(f)


def save(fig, name):
    out = os.path.join(OUT_DIR, name)
    fig.savefig(out, dpi=300, facecolor="white", bbox_inches="tight", pad_inches=0.04)
    plt.close(fig)
    print("saved", out)


def plot_confusion_matrices(ev):
    synth, unseen = ev["synthetic_holdout"], ev["unseen_natural_holdout"]
    fig, axes = plt.subplots(1, 2, figsize=(5.7, 2.7))
    panels = [
        (axes[0], np.array(synth["confusion_matrix"]),
         f"Synthetic test split (N = {synth['test_rows']:,})\naccuracy {synth['accuracy'] * 100:.2f}%", "Blues"),
        (axes[1], np.array(unseen["confusion_matrix"]),
         f"Clinical benchmark set (N = {unseen['test_rows']})\naccuracy {unseen['accuracy'] * 100:.2f}%", "Greens"),
    ]
    for ax, cm, title, cmap in panels:
        ax.imshow(cm, cmap=cmap, vmin=0)
        ax.set_title(title, pad=6)
        ax.set_xticks(range(3))
        ax.set_yticks(range(3))
        ax.set_xticklabels(LABELS)
        ax.set_yticklabels(LABELS)
        ax.set_xlabel("Predicted label")
        ax.set_ylabel("True label")
        for s in ax.spines.values():
            s.set_visible(False)
        ax.tick_params(length=0)
        thresh = cm.max() / 2.0
        for i in range(3):
            for j in range(3):
                ax.text(j, i, f"{cm[i, j]}", ha="center", va="center", fontsize=9, fontweight="bold",
                        color="white" if cm[i, j] > thresh else "#0f172a")
    fig.tight_layout()
    save(fig, "fig_5_1_confusion_matrices.png")


def plot_classification_metrics(ev):
    rep = ev["unseen_natural_holdout"]["classification_report"]
    n = ev["unseen_natural_holdout"]["test_rows"]
    acc = ev["unseen_natural_holdout"]["accuracy"] * 100
    series = [("Precision", "precision", BLUE), ("Recall", "recall", RED), ("F1-score", "f1-score", GREEN)]
    x = np.arange(len(LABELS))
    width = 0.25
    fig, ax = plt.subplots(figsize=(5.7, 2.9))
    for k, (name, key, color) in enumerate(series):
        vals = [rep[c][key] * 100 for c in LABELS]
        bars = ax.bar(x + (k - 1) * width, vals, width, label=name, color=color)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 1.2, f"{v:.1f}", ha="center", va="bottom", fontsize=6)
    ax.set_ylim(0, 118)
    ax.set_ylabel("Score (%)")
    ax.set_xticks(x)
    ax.set_xticklabels(LABELS, fontweight="bold")
    ax.set_title(f"Per-class metrics on clinical benchmark set (N = {n}, accuracy {acc:.2f}%)", pad=8)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.set_axisbelow(True)
    ax.legend(loc="upper center", ncol=3, frameon=False, bbox_to_anchor=(0.5, 1.0))
    fig.tight_layout()
    save(fig, "fig_5_2_classification_metrics.png")


def plot_feature_weights(feats):
    fig, axes = plt.subplots(1, 3, figsize=(5.7, 3.0), sharex=False)
    for ax, cls in zip(axes, LABELS):
        items = list(reversed(feats[cls][:10]))
        ax.barh([i["token"] for i in items], [i["weight"] for i in items], color=CLASS_COLOR[cls], alpha=0.9)
        ax.set_title(cls, color=CLASS_COLOR[cls], pad=4)
        ax.set_xlabel("SVM weight")
        ax.grid(axis="x", linestyle="--", alpha=0.35)
        ax.set_axisbelow(True)
        ax.tick_params(axis="y", length=0)
    fig.tight_layout(w_pad=1.0)
    save(fig, "fig_5_3_svm_feature_weights.png")


def plot_latency(bench):
    stages = ["spaCy\npreprocessing", "TF-IDF + calibrated\nSVM inference", "Whole API call\n(local, in-memory DB)"]
    keys = ["spacy_preprocess_ms", "tfidf_calibrated_svm_ms", "end_to_end_local_api_ms"]
    series = [("Mean", "mean", BLUE), ("95th percentile", "p95", PURPLE), ("Maximum", "max", AMBER)]
    x = np.arange(len(stages))
    width = 0.25
    fig, ax = plt.subplots(figsize=(5.7, 2.9))
    top = 0
    for k, (name, key, color) in enumerate(series):
        vals = [bench[s][key] for s in keys]
        top = max(top, max(vals))
        bars = ax.bar(x + (k - 1) * width, vals, width, label=name, color=color)
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.8, f"{v:.1f}", ha="center", va="bottom", fontsize=6)
    ax.set_ylim(0, top * 1.22)
    ax.set_ylabel("Latency (ms)")
    ax.set_xticks(x)
    ax.set_xticklabels(stages)
    ax.set_title(f"Application processing time over {bench['num_requests']} sequential requests", pad=8)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.set_axisbelow(True)
    ax.legend(loc="upper left", frameon=False)
    fig.tight_layout()
    save(fig, "fig_5_4_latency_benchmark.png")


def plot_scheduling(sim):
    groups = ["Emergency", "Urgent", "Routine", "Overall"]
    fifo = [sim["fifo_baseline"][g]["mean_wait_hours"] for g in groups]
    pol = [sim["priority_preemption"][g]["mean_wait_hours"] for g in groups]
    x = np.arange(len(groups))
    width = 0.36
    fig, ax = plt.subplots(figsize=(5.7, 3.1))
    b1 = ax.bar(x - width / 2, fifo, width, label="FIFO baseline", color=SLATE)
    b2 = ax.bar(x + width / 2, pol, width, label="Implemented priority policy with preemption", color=BLUE)
    for b, v in zip(b1, fifo):
        ax.text(b.get_x() + b.get_width() / 2, v + 1.5, f"{v:.2f} h", ha="center", va="bottom", fontsize=6)
    for b, v, f in zip(b2, pol, fifo):
        change = (v - f) / f * 100
        color = GREEN if change < 0 else RED
        ax.text(b.get_x() + b.get_width() / 2, v + 1.5, f"{v:.2f} h", ha="center", va="bottom", fontsize=6)
        ax.text(b.get_x() + b.get_width() / 2, v + 11.5, f"{change:+.1f}%", ha="center", va="bottom", fontsize=6.6,
                fontweight="bold", color=color)
    ax.set_ylim(0, max(fifo + pol) * 1.3)
    ax.set_ylabel("Mean scheduled waiting time (hours)")
    ax.set_xticks(x)
    ax.set_xticklabels(groups, fontweight="bold")
    ax.set_title(f"Simulated waiting time by urgency tier (N = {sim['num_patients']} patients, "
                 f"{sim['preemptions_triggered']} preemptions)", pad=8)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.set_axisbelow(True)
    ax.legend(loc="upper left", frameon=False)
    fig.tight_layout()
    save(fig, "fig_5_5_scheduling_comparison.png")


def main():
    ev = load_json("backend/ml/evaluation_results.json")
    feats = load_json("backend/ml/svm_top_features.json")
    bench = load_json("backend/tests/benchmark_results.json")
    sim = load_json("backend/tests/scheduling_simulation_results.json")
    plot_confusion_matrices(ev)
    plot_classification_metrics(ev)
    plot_feature_weights(feats)
    plot_latency(bench)
    plot_scheduling(sim)
    print("Chapter 5 charts written to", OUT_DIR)


if __name__ == "__main__":
    main()
