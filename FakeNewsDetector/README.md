# 🔍 FakeNewsDetector

Verify news claims using real Google search results (SerpApi), AI-powered evidence analysis (OpenRouter), and a local ML classifier trained on the LIAR dataset.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📋 Features

- **Live Web Search** — Queries Google via SerpApi and ranks results by source credibility (fact-checkers, official sites, reputable news outlets)
- **AI Evidence Analysis** — OpenRouter LLM weighs supporting and contradicting evidence to produce a verdict
- **Local ML Pre-screening** — TF-IDF + Logistic Regression classifier trained on the LIAR dataset provides an instant first-pass signal
- **Multi-language Support** — Detects Hindi, Bengali, Tamil, Telugu, Arabic/Urdu claims and adjusts search accordingly
- **Smart Caching** — SQLite-backed 6-hour TTL cache prevents redundant API calls
- **Article Scraping** — Fetches full article text from top credible sources via Jina Reader for deeper analysis
- **Source Transparency** — Every source shown is a real retrieved result, nothing invented

## 🏗️ Project Structure

```
FakeNewsDetector/
├── frontend/              # React + Vite UI
│   ├── src/
│   │   ├── App.jsx        # Main app with hero, how-it-works, about sections
│   │   ├── App.css        # Complete styling (responsive)
│   │   ├── index.css      # CSS variables & base styles
│   │   ├── main.jsx       # React entry point
│   │   └── components/
│   │       ├── NewsInput.jsx   # Claim input textarea with validation
│   │       ├── ResultCard.jsx  # Verdict display, evidence, ML card, sources
│   │       └── SourceList.jsx  # Cited sources list
│   ├── public/images/     # SVG illustrations
│   ├── index.html         # HTML entry with Google Fonts
│   └── vite.config.js     # Vite config
│
├── backend/               # Node.js + Express API
│   ├── server.js          # Express server entry
│   ├── routes/
│   │   └── verify.js      # POST /api/verify — main verification pipeline
│   └── services/
│       ├── webSearch.js    # SerpApi search, credibility ranking, article scraping
│       ├── aiAnalysis.js   # OpenRouter LLM analysis with structured prompts
│       ├── mlPredict.js    # Client for the Python ML service
│       └── cache.js        # SQLite cache (better-sqlite3)
│
├── ml_service/            # Python ML microservice
│   ├── app.py             # FastAPI server (GET /health, POST /predict)
│   ├── train.py           # Training script (auto-downloads LIAR dataset)
│   ├── dataset/           # LIAR dataset TSV files
│   ├── requirements.txt   # Python dependencies
│   └── README.md          # ML service docs & custom training guide
│
└── notebooks/             # Jupyter notebooks for EDA
```

## 🚀 Setup & Run

### Prerequisites

- **Node.js** 18+
- **Python** 3.9+
- **API Keys:**
  - [SerpApi](https://serpapi.com/) — for Google search
  - [OpenRouter](https://openrouter.ai/) — for AI analysis (uses `gpt-4o-mini` by default)

### 1. ML Service (Port 8002)

```bash
cd ml_service
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python3 train.py          # downloads LIAR dataset & trains model
./venv/bin/python3 app.py            # starts on http://localhost:8002
```

### 2. Backend API (Port 8001)

```bash
cd backend
cp .env.example .env                 # fill in your API keys
npm install
npm start                            # starts on http://localhost:8001
```

### 3. Frontend (Port 5173)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                          # starts on http://localhost:5173
```

## 🔄 How It Works

```
User enters claim
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│  ML Pre-screen  │     │  SerpApi Search   │
│  (local, fast)  │     │  (3 smart queries)│
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │              ┌────────▼─────────┐
         │              │  Credibility     │
         │              │  Ranking + Scrape│
         │              └────────┬─────────┘
         │                       │
         │              ┌────────▼─────────┐
         │              │  OpenRouter LLM  │
         │              │  Evidence Analysis│
         │              └────────┬─────────┘
         │                       │
         └──────────┬────────────┘
                    ▼
           Final Response
   (verdict, confidence, sources, ML signal)
```

## 📊 Verdicts

| Verdict | Meaning |
|---------|---------|
| ✅ **TRUE** | Reliable evidence substantially supports the claim |
| ❌ **FALSE** | Reliable evidence substantially contradicts the claim |
| ⚠️ **MISLEADING** | Significant distortion, missing context, or inaccurate framing |
| 🔍 **UNVERIFIED** | Evidence is insufficient, inconclusive, or conflicting |

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `8001`) |
| `CORS_ORIGINS` | Allowed origins (`*` for all) |
| `SERPAPI_API_KEY` | Your SerpApi key |
| `OPENROUTER_API_KEY` | Your OpenRouter key |
| `OPENROUTER_MODEL` | AI model (default: `openai/gpt-4o-mini`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (default: `http://localhost:8001`) |

## 📝 License

MIT
