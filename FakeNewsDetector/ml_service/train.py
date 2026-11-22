"""
=============================================================================
  FakeNewsDetector — ML Training Script
  Model: TF-IDF (unigrams + bigrams) + Logistic Regression
  Dataset: LIAR dataset (Wang, 2017) — 12,836 labeled political statements
=============================================================================

HOW TO RUN:
  1. Download dataset (auto-downloads if not present):
       python3 train.py

  OR manually download from:
       https://huggingface.co/datasets/liar/resolve/main/data/train.tsv
       https://huggingface.co/datasets/liar/resolve/main/data/valid.tsv
       https://huggingface.co/datasets/liar/resolve/main/data/test.tsv
     and put all .tsv files in: ml_service/dataset/

WHAT IT DOES:
  - Maps 6 LIAR labels → our 4 labels (TRUE/FALSE/MISLEADING/UNVERIFIED)
  - Trains TF-IDF vectorizer + Logistic Regression
  - Evaluates on test set
  - Saves trained model + vectorizer to model/ folder
=============================================================================
"""

import os
import sys
import urllib.request
import pandas as pd
import numpy as np
import joblib

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR  = os.path.join(SCRIPT_DIR, "dataset")
MODEL_DIR    = os.path.join(SCRIPT_DIR, "model")
MODEL_PATH   = os.path.join(MODEL_DIR, "classifier.joblib")
LABEL_PATH   = os.path.join(MODEL_DIR, "labels.joblib")

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(MODEL_DIR,   exist_ok=True)

# ── LIAR Dataset Download URLs ────────────────────────────────────────────────
LIAR_URLS = {
    "train.tsv": "https://raw.githubusercontent.com/thiagorainmaker77/liar_dataset/master/train.tsv",
    "valid.tsv": "https://raw.githubusercontent.com/thiagorainmaker77/liar_dataset/master/valid.tsv",
    "test.tsv":  "https://raw.githubusercontent.com/thiagorainmaker77/liar_dataset/master/test.tsv",
}

# LIAR column names (dataset has no header row)
LIAR_COLUMNS = [
    "id", "label", "statement", "subjects",
    "speaker", "job", "state", "party",
    "barely_true_counts", "false_counts", "half_true_counts",
    "mostly_true_counts", "pants_on_fire_counts", "context"
]

# ── Label Mapping: LIAR (6 labels) → Our System (4 labels) ───────────────────
# LIAR labels: true, mostly-true, half-true, barely-true, false, pants-fire
LABEL_MAP = {
    "true":        "TRUE",        # Fully true → TRUE
    "mostly-true": "TRUE",        # Mostly true → TRUE (slight imprecision)
    "half-true":   "MISLEADING",  # Half true = misleading framing
    "barely-true": "MISLEADING",  # Barely true = mostly misleading
    "false":       "FALSE",       # Clearly false → FALSE
    "pants-fire":  "FALSE",       # Pants on fire (most false) → FALSE
}


def download_dataset():
    """Download LIAR dataset files if not already present."""
    all_present = all(
        os.path.exists(os.path.join(DATASET_DIR, f)) for f in LIAR_URLS
    )
    if all_present:
        print("✅ Dataset already downloaded.")
        return

    print("📥 Downloading LIAR dataset...")
    for filename, url in LIAR_URLS.items():
        dest = os.path.join(DATASET_DIR, filename)
        if os.path.exists(dest):
            print(f"   Skipping {filename} (exists)")
            continue
        print(f"   Downloading {filename}...")
        try:
            import requests
            r = requests.get(url, headers={"User-Agent": "FakeNewsDetector/1.0"}, timeout=30)
            r.raise_for_status()
            with open(dest, "wb") as f:
                f.write(r.content)
            print(f"   ✅ {filename} saved ({os.path.getsize(dest)//1024} KB)")
        except Exception as e:
            print(f"   ❌ Failed to download {filename}: {e}")
            print(f"\n   Please manually download from:")
            print(f"   {url}")
            print(f"   and save it to: {DATASET_DIR}/\n")
            sys.exit(1)


def load_split(filename):
    """Load a LIAR .tsv split into a DataFrame with mapped labels."""
    path = os.path.join(DATASET_DIR, filename)
    df = pd.read_csv(path, sep="\t", header=None,
                     names=LIAR_COLUMNS, quoting=3,
                     on_bad_lines='skip')
    # Keep only rows with known labels
    df = df[df["label"].isin(LABEL_MAP)].copy()
    df["mapped_label"] = df["label"].map(LABEL_MAP)
    # Text feature: statement (primary) + subjects + speaker context
    df["text"] = (
        df["statement"].fillna("") + " " +
        df["subjects"].fillna("") + " " +
        df["speaker"].fillna("") + " " +
        df["job"].fillna("") + " " +
        df["context"].fillna("")
    ).str.strip()
    return df[["text", "mapped_label"]].dropna()


def train():
    print("\n" + "="*60)
    print("  FakeNewsDetector — ML Training")
    print("="*60)

    # 1. Download dataset
    download_dataset()

    # 2. Load splits
    print("\n📂 Loading dataset splits...")
    train_df = load_split("train.tsv")
    valid_df  = load_split("valid.tsv")
    test_df   = load_split("test.tsv")
    print(f"   Train: {len(train_df):,} samples")
    print(f"   Valid: {len(valid_df):,} samples")
    print(f"   Test:  {len(test_df):,} samples")

    # Combine train + validation for final training
    full_train = pd.concat([train_df, valid_df], ignore_index=True)

    # 3. Label distribution
    print("\n📊 Label distribution (train+valid):")
    dist = full_train["mapped_label"].value_counts()
    for lbl, cnt in dist.items():
        pct = cnt / len(full_train) * 100
        bar = "█" * int(pct / 2)
        print(f"   {lbl:<12} {cnt:>5}  {bar} {pct:.1f}%")

    # 4. Encode labels
    le = LabelEncoder()
    y_train = le.fit_transform(full_train["mapped_label"])
    y_test  = le.transform(test_df["mapped_label"])
    print(f"\n🏷  Classes: {list(le.classes_)}")

    # 5. Build pipeline: TF-IDF → Logistic Regression
    print("\n🔧 Building TF-IDF + Logistic Regression pipeline...")
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),   # unigrams, bigrams, trigrams
            max_features=100_000, # top 100k features
            sublinear_tf=True,    # log-normalise TF
            min_df=2,             # ignore terms appearing < 2 times
            strip_accents="unicode",
            analyzer="word",
            token_pattern=r"(?u)\b\w\w+\b",
        )),
        ("clf", LogisticRegression(
            C=1.0,              # regularisation strength
            max_iter=1000,
            solver="lbfgs",
            multi_class="multinomial",
            class_weight="balanced",  # handle class imbalance
            n_jobs=-1,
        )),
    ])

    # 6. Train
    print("🚀 Training... (this takes ~30-60 seconds on CPU)")
    pipeline.fit(full_train["text"], y_train)
    print("✅ Training complete!")

    # 7. Evaluate on test set
    print("\n📈 Evaluation on held-out test set:")
    y_pred = pipeline.predict(test_df["text"])
    acc = accuracy_score(y_test, y_pred)
    print(f"\n   Overall Accuracy: {acc:.2%}")
    print("\n   Per-class Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # 8. Save model
    joblib.dump(pipeline, MODEL_PATH)
    joblib.dump(le, LABEL_PATH)
    print(f"\n💾 Model saved to:  {MODEL_PATH}")
    print(f"   Labels saved to: {LABEL_PATH}")
    print("\n🎉 Done! You can now start the ML service with:")
    print("   python3 app.py\n")


if __name__ == "__main__":
    train()
