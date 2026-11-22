import SourceList from './SourceList.jsx';

const VERDICTS = {
  TRUE:        { label: 'Likely True',  tone: 'true',        emoji: '✅', desc: 'Reliable evidence substantially supports the claim.' },
  FALSE:       { label: 'Likely False', tone: 'false',       emoji: '❌', desc: 'Reliable evidence substantially contradicts the claim.' },
  MISLEADING:  { label: 'Misleading',   tone: 'misleading',  emoji: '⚠️', desc: 'Significant distortion, missing context, or inaccurate framing.' },
  UNVERIFIED:  { label: 'Unverified',   tone: 'unverified',  emoji: '🔍', desc: 'Evidence is insufficient, inconclusive, or conflicting.' },
  // legacy aliases (backwards compat)
  LIKELY_TRUE_News:  { label: 'Likely True',  tone: 'true',       emoji: '✅', desc: 'Reliable evidence substantially supports the claim.' },
  LIKELY_FALSE_News: { label: 'Likely False', tone: 'false',      emoji: '❌', desc: 'Reliable evidence substantially contradicts the claim.' },
};

function EvidenceList({ title, items, tone, testid }) {
  return (
    <div className={`evidence evidence-${tone}`} data-testid={testid}>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted">None found in the retrieved sources.</p>
      ) : (
        <ul>
          {items.map((e, i) => (
            <li key={i}>
              {e.point}
              {e.sourceUrl && (
                <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="cite">
                  {e.sourceTitle || e.sourceUrl}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShareButton({ result, v }) {
  const share = async () => {
    const text = `🔍 FakeNewsDetector Result\n\n${v.emoji} Verdict: ${v.label} (${result.confidence}% confidence)\n\n📋 Claim: "${result.claim.slice(0, 120)}${result.claim.length > 120 ? '…' : ''}"\n\n📝 ${result.explanation}\n\n🔗 Verified via FakeNewsDetector`;
    if (navigator.share) {
      try { await navigator.share({ title: 'FakeNewsDetector Result', text }); return; } catch { /* fallback */ }
    }
    await navigator.clipboard.writeText(text);
    alert('Result copied to clipboard! Paste it anywhere to share.');
  };
  return (
    <button className="btn btn-ghost btn-share" onClick={share} title="Share this result">
      📤 Share
    </button>
  );
}

function MLAnalysisCard({ ml }) {
  if (!ml || !ml.model_loaded) return null;
  const verdictColors = {
    TRUE: 'ml-val-true',
    FALSE: 'ml-val-false',
    MISLEADING: 'ml-val-misleading',
    UNVERIFIED: 'ml-val-unverified'
  };
  const verdictClass = verdictColors[ml.verdict] || '';

  return (
    <div className="ml-card" data-testid="ml-analysis">
      <div className="ml-header">
        <div className="ml-title-wrap">
          <span className="ml-badge">🤖 Local ML Model</span>
          <span className="ml-subtitle">Supervised Classifier (Trained on LIAR Dataset)</span>
        </div>
        <div className="ml-prediction-pill">
          <span className="ml-pred-label">ML Verdict:</span>
          <strong className={`ml-pred-val ${verdictClass}`}>{ml.verdict}</strong>
          <span className="ml-pred-conf">{ml.confidence}% match</span>
        </div>
      </div>

      <div className="ml-bars-container">
        {ml.probabilities && Object.entries(ml.probabilities).map(([label, prob]) => {
          const pct = Math.round(prob * 100);
          return (
            <div key={label} className="ml-bar-item">
              <div className="ml-bar-meta">
                <span className="ml-bar-label">{label}</span>
                <span className="ml-bar-pct">{pct}%</span>
              </div>
              <div className="ml-track">
                <div
                  className={`ml-bar-fill ml-fill-${label.toLowerCase()}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="ml-footer-note">
        ⚡ <strong>First-pass screening:</strong> Analyzed locally using TF-IDF n-grams + Logistic Regression before web retrieval.
      </p>
    </div>
  );
}

export default function ResultCard({ result }) {
  const v = VERDICTS[result.verdict] || VERDICTS.UNVERIFIED;
  return (
    <section className={`result tone-${v.tone}`} data-testid="result-card">
      <div className="result-head">
        <div>
          <p className="eyebrow">Verification status</p>
          <h2 className="verdict" data-testid="verdict-status">
            <span className="verdict-emoji">{v.emoji}</span> {v.label}
          </h2>
          <code className="verdict-code">{result.verdict}</code>
          <p className="muted">{v.desc}</p>
          {result.fromCache && (
            <span className="cache-badge" title="This result was served from cache (verified recently)">
              ⚡ Cached result
            </span>
          )}
        </div>
        <div className="result-head-right">
          <div className="confidence" data-testid="confidence-score">
            <div className="ring" style={{ '--p': result.confidence }}>
              <span>{result.confidence}%</span>
            </div>
            <small>evidence strength</small>
          </div>
          <ShareButton result={result} v={v} />
        </div>
      </div>

      <p className="explanation" data-testid="result-explanation">{result.explanation}</p>

      {result.mlAnalysis && <MLAnalysisCard ml={result.mlAnalysis} />}

      <div className="evidence-grid">
        <EvidenceList
          title="Supporting evidence"
          items={result.supportingEvidence}
          tone="support"
          testid="supporting-evidence"
        />
        <EvidenceList
          title="Contradicting evidence"
          items={result.contradictingEvidence}
          tone="contra"
          testid="contradicting-evidence"
        />
      </div>

      <div className="limits" data-testid="confidence-explanation">
        <h4>Confidence &amp; limitations</h4>
        <p>{result.confidenceExplanation}</p>
        <p className="muted small">
          Confidence measures how strongly the retrieved evidence points one way — it is not a guarantee of truth.
          Always read the original sources before drawing conclusions.
        </p>
      </div>

      <SourceList sources={result.sources} retrievedCount={result.retrievedCount} />

      {result.searchedAt && (
        <p className="muted small result-footer">
          {result.fromCache ? '⚡ Cached' : '🔄 Fresh search'} ·{' '}
          {new Date(result.searchedAt).toLocaleString()} ·{' '}
          Model: {result.model || 'N/A'}
        </p>
      )}
    </section>
  );
}
