"""
=============================================================================
  FakeNewsDetector — ML Prediction Service
  Serves the trained TF-IDF + Logistic Regression model via HTTP.

  Start with:  python3 app.py
  Runs on:     http://localhost:8002

  Endpoints:
    GET  /health          → {"status": "ok", "model_loaded": true}
    POST /predict         → {"verdict", "confidence", "probabilities", "method"}
=============================================================================
"""

import os
import sys
import logging
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
import uvicorn

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("ml_service")

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, "model", "classifier.joblib")
LABEL_PATH  = os.path.join(SCRIPT_DIR, "model", "labels.joblib")

# ── Load Model ────────────────────────────────────────────────────────────────
pipeline = None
label_encoder = None

def load_model():
    global pipeline, label_encoder
    if not os.path.exists(MODEL_PATH):
        log.warning(
            "Model not found. Train it first:\n"
            "  cd ml_service && python3 train.py"
        )
        return False
    try:
        pipeline      = joblib.load(MODEL_PATH)
        label_encoder = joblib.load(LABEL_PATH)
        log.info(f"✅ Model loaded. Classes: {list(label_encoder.classes_)}")
        return True
    except Exception as e:
        log.error(f"Failed to load model: {e}")
        return False

model_loaded = load_model()

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="FakeNewsDetector ML Service",
    description="Local TF-IDF + Logistic Regression classifier for fake news detection",
    version="1.0.0",
)

# ── Request / Response Schemas ────────────────────────────────────────────────
class PredictRequest(BaseModel):
    claim: str

    @field_validator("claim")
    @classmethod
    def claim_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("claim must not be empty")
        return v.strip()[:3000]


class PredictResponse(BaseModel):
    verdict:       str
    confidence:    int           # 0-100
    probabilities: dict          # {label: probability}
    method:        str           # always "tfidf_logreg"
    model_loaded:  bool


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model_loaded}


# ── Prediction ────────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not model_loaded or pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please train first: cd ml_service && python3 train.py"
        )

    try:
        # Get class probabilities
        proba = pipeline.predict_proba([req.claim])[0]          # shape: (n_classes,)
        classes = label_encoder.classes_                         # e.g. ['FALSE','MISLEADING','TRUE','UNVERIFIED']

        # Build label → probability dict
        prob_dict = {cls: float(round(p, 4)) for cls, p in zip(classes, proba)}

        # Best label + confidence
        best_idx    = int(np.argmax(proba))
        best_label  = classes[best_idx]
        best_conf   = int(round(proba[best_idx] * 100))

        log.info(f"Prediction: {best_label} ({best_conf}%) | claim[:60]: {req.claim[:60]}")

        return PredictResponse(
            verdict=best_label,
            confidence=best_conf,
            probabilities=prob_dict,
            method="tfidf_logreg",
            model_loaded=True,
        )

    except Exception as e:
        log.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("ML_PORT", 8002))
    log.info(f"🚀 ML Service starting on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
