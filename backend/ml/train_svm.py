import json
import os
import sys
import warnings
import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC

warnings.filterwarnings("ignore")

try:
    from backend.ml.preprocess import preprocess_text
except ImportError:
    from preprocess import preprocess_text


def train_model():
    base_dir = os.path.dirname(__file__)
    csv_path = os.path.join(base_dir, "symptom_data.csv")
    if not os.path.exists(csv_path):
        print(f"Dataset not found at {csv_path}. Please run dataset_generator.py first.")
        return

    print("Loading dataset...")
    df = pd.read_csv(csv_path).drop_duplicates(subset=["symptom_text"]).reset_index(drop=True)

    print("Preprocessing text with SpaCy (en_core_web_sm)...")
    try:
        df["processed_text"] = df["symptom_text"].apply(preprocess_text)
    except OSError:
        print("SpaCy model 'en_core_web_sm' not found. Please install it.")
        return

    X = df["processed_text"]
    y = df["triage_level"]

    print("Splitting data (80/20 stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Setting up TF-IDF + Calibrated Linear SVM pipeline and 5-fold GridSearchCV...")
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(max_features=3000)),
        ("clf", CalibratedClassifierCV(SVC(kernel="linear", class_weight="balanced"), cv=3)),
    ])

    parameters = {
        "tfidf__ngram_range": [(1, 1), (1, 2)],
        "clf__estimator__C": [1, 10],
    }

    grid_search = GridSearchCV(pipeline, parameters, cv=5, n_jobs=-1, verbose=1)

    print("Training calibrated SVM model with 5-fold cross-validation...")
    grid_search.fit(X_train, y_train)

    print("Best parameters:", grid_search.best_params_)
    best_model = grid_search.best_estimator_

    print("\nEvaluating model on 20% unseen holdout set...")
    y_pred = best_model.predict(X_test)
    labels = ["Emergency", "Urgent", "Routine"]

    acc = float(accuracy_score(y_test, y_pred))
    report_dict = classification_report(y_test, y_pred, labels=labels, output_dict=True)
    cm = confusion_matrix(y_test, y_pred, labels=labels)

    print(f"\nAccuracy: {acc:.4f}")
    print("\nClassification Report (Precision, Recall, F1-Score):")
    print(classification_report(y_test, y_pred, labels=labels))
    print("\nConfusion Matrix (rows=true, cols=pred, order=[Emergency, Urgent, Routine]):")
    print(cm)

    model_path = os.path.join(base_dir, "triage_model.pkl")
    print(f"\nSaving best model to {model_path}...")
    joblib.dump(best_model, model_path)

    training_summary = {
        "dataset_rows": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "cv_folds": 5,
        "best_params": {k: str(v) for k, v in grid_search.best_params_.items()},
        "best_cv_score": float(grid_search.best_score_),
        "vocab_size": int(len(best_model.named_steps["tfidf"].vocabulary_)),
        "model_bytes": int(os.path.getsize(model_path)),
        "test_accuracy": acc,
        "labels": labels,
        "confusion_matrix": cm.tolist(),
        "classification_report": report_dict,
    }
    # Kept separate from evaluation_results.json, which evaluate_model.py owns
    summary_path = os.path.join(base_dir, "training_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(training_summary, f, indent=2)

    print(f"Model saved ({training_summary['model_bytes']} bytes) and training summary written to {summary_path}.")


if __name__ == "__main__":
    train_model()
