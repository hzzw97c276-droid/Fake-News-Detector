# 🤖 FakeNewsDetector — Local ML Service

A local, dedicated Machine Learning service for fake news classification.
It operates as a **first-pass pre-screener** alongside web search and deep LLM analysis.

---

## 🏗️ Architecture & Model

- **Feature Extraction:** TF-IDF Vectorizer with unigrams, bigrams, and trigrams (`ngram_range=(1, 3)`), sublinear TF scaling, and top 100,000 features.
- **Classifier:** Multinomial Logistic Regression (`solver="lbfgs"`, balanced class weights).
- **Default Dataset:** **LIAR Dataset** (Wang, 2017) — 12,836 real political statements fact-checked by PolitiFact across 6 labels mapped to:
  - `TRUE` (true, mostly-true)
  - `MISLEADING` (half-true, barely-true)
  - `FALSE` (false, pants-on-fire)

---

## 🚀 Quick Start

### 1. Set Up Environment & Install Dependencies
```bash
cd ml_service
/usr/bin/python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```

### 2. Train the Model on the LIAR Dataset
```bash
./venv/bin/python3 train.py
```
This automatically downloads the LIAR dataset splits (`train.tsv`, `valid.tsv`, `test.tsv`), trains the pipeline, evaluates accuracy on the test set, and saves:
- `model/classifier.joblib`
- `model/labels.joblib`

### 3. Start the ML Prediction Service
```bash
./venv/bin/python3 app.py
```
Runs at **`http://localhost:8002`**.
- `GET  /health`  — Health status & model loaded flag
- `POST /predict` — Fast inference endpoint:
```json
// POST http://localhost:8002/predict
{ "claim": "NASA discovered water on Mars" }

// Response:
{
  "verdict": "TRUE",
  "confidence": 62,
  "probabilities": { "FALSE": 0.15, "MISLEADING": 0.23, "TRUE": 0.62 },
  "method": "tfidf_logreg",
  "model_loaded": true
}
```

---

## 🎯 Apne Custom Dataset Se Kaise Train Karein (How to Train with Your Own Dataset)

Agar tumhare paas apna custom dataset hai (e.g. CSV file), toh tum use aasani se train kar sakte ho:

### Step 1: Apna CSV taiyar karo
Ek CSV file banao (e.g., `ml_service/dataset/custom_news.csv`) jisme kam se kam do columns hon:
- `text` — News statement / claim text
- `label` — `TRUE`, `FALSE`, ya `MISLEADING`

Example `custom_news.csv`:
```csv
text,label
UNESCO declared Indian national anthem best in world,FALSE
India won the 1983 Cricket World Cup under Kapil Dev,TRUE
Drinking boiled garlic water cures coronavirus within 24 hours,FALSE
Government gives free 500 rs recharge to all mobile users,FALSE
Chandrayaan-3 successfully landed on the moon south pole,TRUE
```

### Step 2: Custom Train Script (`train_custom.py`) Run Karo
Ek simple custom training command run karo ya `train.py` mein path change karo:
```bash
./venv/bin/python3 -c '
import pandas as pd
import joblib
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

# 1. Load your CSV
df = pd.read_csv("dataset/custom_news.csv")
df = df.dropna(subset=["text", "label"])

# 2. Encode labels
le = LabelEncoder()
y = le.fit_transform(df["label"].str.upper())

# 3. Train
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=50000)),
    ("clf", LogisticRegression(class_weight="balanced", max_iter=1000))
])
pipeline.fit(df["text"], y)

# 4. Save
joblib.dump(pipeline, "model/classifier.joblib")
joblib.dump(le, "model/labels.joblib")
print("✅ Custom model trained and saved!")
'
```

Jab bhi naya model save hoga, `app.py` ko restart karo (`./venv/bin/python3 app.py`) aur naya model automatically use hone lagega!
