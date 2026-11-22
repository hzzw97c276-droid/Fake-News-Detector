export default function SourceList({ sources, retrievedCount }) {
  return (
    <div className="sources" data-testid="source-list">
      <h4>
        Sources Used for Verification
        {retrievedCount ? <span className="muted small"> · {sources.length} cited of {retrievedCount} retrieved</span> : null}
      </h4>
      {sources.length === 0 ? (
        <p className="muted" data-testid="no-sources">No sources could be used to verify this claim.</p>
      ) : (
        <ol>
          {sources.map((s, i) => (
            <li key={s.url} className="source" data-testid={`source-item-${i}`}>
              <div className="source-meta">
                <span className="domain">{s.domain || new URL(s.url).hostname}</span>
                {s.publishedDate && <span className="date">{s.publishedDate}</span>}
              </div>
              <a href={s.url} target="_blank" rel="noopener noreferrer" data-testid={`source-link-${i}`}>
                {s.title}
              </a>
              {s.snippet && <p>{s.snippet}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
