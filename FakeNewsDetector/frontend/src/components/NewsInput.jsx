const MAX = 3000;
const MIN = 10;

export default function NewsInput({ claim, setClaim, onVerify, onClear, loading }) {
  const len = claim.trim().length;
  const canVerify = len >= MIN && claim.length <= MAX && !loading;

  return (
    <div className="input-card">
      <textarea
        className="claim-input"
        data-testid="claim-textarea"
        placeholder="Paste a news headline, claim, or article here..."
        value={claim}
        maxLength={MAX}
        onChange={(e) => setClaim(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canVerify) onVerify();
        }}
      />
      <div className="input-footer">
        <span className={`counter ${claim.length > MAX * 0.9 ? 'warn' : ''}`} data-testid="char-counter">
          {claim.length} / {MAX}
        </span>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClear} disabled={loading || !claim} data-testid="clear-button">
            Clear
          </button>
          <button className="btn btn-primary" onClick={onVerify} disabled={!canVerify} data-testid="verify-button">
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Verifying…' : 'Verify News'}
          </button>
        </div>
      </div>
      {len > 0 && len < MIN && <p className="hint" data-testid="min-length-hint">Enter at least {MIN} characters.</p>}
    </div>
  );
}
