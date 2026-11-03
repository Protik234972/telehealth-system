import pandas as pd
import spacy
import os
import joblib
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import warnings
warnings.filterwarnings('ignore') # to avoid cluttering output

def train_model():
    csv_path = os.path.join(os.path.dirname(__file__), 'symptom_data.csv')
    if not os.path.exists(csv_path):
        print(f"Dataset not found at {csv_path}. Please run dataset_generator.py first.")
        return
        
    print("Loading dataset...")
    df = pd.read_csv(csv_path)
    
    print("Loading SpaCy model...")
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        print("SpaCy model 'en_core_web_sm' not found. Please install it.")
        return
    
    def preprocess_text(text):
        doc = nlp(text.lower())
        tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct and token.is_alpha]
        return " ".join(tokens)
        
    print("Preprocessing text... (this may take a bit for 10k records)")
    df['processed_text'] = df['symptom_text'].apply(preprocess_text)
    
    X = df['processed_text']
    y = df['triage_level']
    
    print("Splitting data (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Setting up pipeline and GridSearch...")
    # TF-IDF Vectorizer and Support Vector Classifier
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=2000)),
        ('clf', SVC())
    ])
    
    # We will use a smaller grid for speed in this tutorial
    parameters = {
        'tfidf__ngram_range': [(1, 1), (1, 2)],
        'clf__C': [1, 10],
        'clf__kernel': ['linear']
    }
    
    grid_search = GridSearchCV(pipeline, parameters, cv=3, n_jobs=-1, verbose=1)
    
    print("Training SVM model with cross-validation (this might take a minute)...")
    grid_search.fit(X_train, y_train)
    
    print("Best parameters:", grid_search.best_params_)
    best_model = grid_search.best_estimator_
    
    print("\nEvaluating model on test set...")
    y_pred = best_model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    print(f"\nAccuracy: {acc:.4f}")
    
    print("\nClassification Report (Precision, Recall, F1-Score):")
    print(classification_report(y_test, y_pred))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    model_path = os.path.join(os.path.dirname(__file__), 'triage_model.pkl')
    print(f"\nSaving best model to {model_path}...")
    joblib.dump(best_model, model_path)
    print("Model saved successfully! Ready for FastAPI backend.")

if __name__ == "__main__":
    train_model()
