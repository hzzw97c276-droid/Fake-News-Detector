import { useRef, useState } from 'react';
import axios from 'axios';
import NewsInput from './components/NewsInput.jsx';
import ResultCard from './components/ResultCard.jsx';
import './App.css';

const API = `${import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_API_URL || ''}/api`;

const STEPS = [
  { n: '01', title: 'Enter a news claim', text: 'Paste a headline, a factual claim, or a short article you want to check.' },
  { n: '02', title: 'Search real online sources', text: 'We query Google live and prioritise news outlets, official sites and fact-checkers.' },
  { n: '03', title: 'Review the evidence', text: 'AI weighs what the sources say and returns a verdict with every link it used.' },
];

export default function App() {
  const [claim, setClaim] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resultRef = useRef(null);

  const verify = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/verify`, { claim });
      setResult(data);
      setTimeout(() => resultRef.current?.querySelector('.result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not reach the verification service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setClaim('');
    setResult(null);
    setError('');
  };

  return (
    <div className="page">
      <header className="header">
        <a href="#home" className="logo" data-testid="logo-link">
          <span className="logo-mark">✓</span>
          <span>FakeNews<span className="logo-accent">Detector</span></span>
        </a>
        <nav className="nav">
          <a href="#home" data-testid="nav-home">Home</a>
          <a href="#how" data-testid="nav-how">How It Works</a>
          <a href="#about" data-testid="nav-about">About</a>
        </nav>
      </header>

      <main>
        <section id="home" className="hero">
          <p className="eyebrow">Evidence-based news verification</p>
          <h1 className="hero-title" data-testid="hero-title">
            Don't Believe <em>Everything</em> You Read.
          </h1>
          <p className="hero-sub">Verify news claims using real web sources and AI-powered evidence analysis.</p>
          <NewsInput claim={claim} setClaim={setClaim} onVerify={verify} onClear={clear} loading={loading} />
          {error && <div className="error" data-testid="verify-error">{error}</div>}
        </section>

        <section className="visual-gallery" aria-label="How FakeNewsDetector checks a claim">
          <div className="gallery-heading">
            <p className="eyebrow">From claim to context</p>
            <h2 className="section-title">A clearer way to check what you read.</h2>
          </div>
          <div className="gallery-grid">
            <article className="gallery-card">
              <img src="/images/search-sources.svg" alt="A search card finding news articles from multiple sources" />
              <div><span className="gallery-step">01 / FIND</span><h3>Search trusted sources</h3><p>Look beyond the headline and find reporting and references.</p></div>
            </article>
            <article className="gallery-card">
              <img src="/images/compare-evidence.svg" alt="Two source cards being compared as evidence" />
              <div><span className="gallery-step">02 / COMPARE</span><h3>Compare the evidence</h3><p>See what supports a claim and what raises questions.</p></div>
            </article>
            <article className="gallery-card">
              <img src="/images/clear-verdict.svg" alt="A news article with a clear verification check mark" />
              <div><span className="gallery-step">03 / REVIEW</span><h3>Get a clear verdict</h3><p>Review the assessment, confidence, and links to original sources.</p></div>
            </article>
          </div>
        </section>
        <div ref={resultRef}>
          {loading && (
            <div className="loading" data-testid="loading-indicator">
              <span className="pulse" /> Searching the web and weighing the evidence…
            </div>
          )}
          {result && <ResultCard result={result} />}
        </div>

        <section id="how" className="how">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n} data-testid={`step-${s.n}`}>
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="about">
          <h2 className="section-title">About</h2>
          <p>
            FakeNewsDetector retrieves live Google results through SerpApi and asks an AI model to assess the claim
            using <strong>only</strong> that evidence. Every source shown is a real retrieved result — nothing is
            invented. The confidence score reflects the strength of the evidence, not a guarantee of truth. Always
            read the original sources before drawing conclusions.
          </p>
        </section>
      </main>

      <footer className="footer">© {new Date().getFullYear()} FakeNewsDetector · Read critically.</footer>
    </div>
  );
}

