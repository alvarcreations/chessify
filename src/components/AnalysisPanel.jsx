import { formatEval, evalToText, evalColor, getHumannessTag } from '../utils/evaluation';

function MoveLine({ line, rank, bestScore }) {
  const { score, isMate, mateIn, sanMove } = line;
  const evalStr = formatEval(score, isMate, mateIn);
  const evalDesc = evalToText(score, isMate, mateIn);
  const color = evalColor(score, isMate, mateIn);
  const evalDiff = bestScore !== undefined ? score - bestScore : 0;
  const tag = getHumannessTag(sanMove || '', rank, evalDiff);

  return (
    <div className="glass-inner p-4 flex items-center gap-4" style={{ transition: 'transform var(--transition-fast)', cursor: 'default' }}>
      {/* Rank number */}
      <span
        className="hero-number"
        style={{
          fontSize: 28,
          minWidth: 28,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        {rank}
      </span>

      {/* Move + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
            {sanMove || line.pv?.[0] || '...'}
          </span>
          {tag && (
            <span
              className="label"
              style={{
                fontSize: 10,
                color: 'var(--text-secondary)',
                background: 'var(--glass-bg-strong)',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {tag}
            </span>
          )}
        </div>
        <div className="label" style={{ marginTop: 4 }}>
          {evalDesc}
        </div>
      </div>

      {/* Eval hero number */}
      <span
        className="hero-number"
        style={{
          fontSize: 32,
          color,
          minWidth: 80,
          textAlign: 'right',
        }}
      >
        {evalStr}
      </span>
    </div>
  );
}

export default function AnalysisPanel({ lines, depth, targetDepth, analyzing, onAnalyze }) {
  const hasLines = lines && lines.length > 0;
  const bestScore = hasLines ? lines[0].score : 0;
  const progress = targetDepth > 0 ? ((depth || 0) / targetDepth) * 100 : 0;

  return (
    <div className="glass-static flex flex-col" style={{ overflow: 'hidden' }}>
      {/* Progress bar */}
      {analyzing && (
        <div style={{ height: 2, background: 'var(--glass-bg)' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
      )}

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="label">Top Lines</span>
          {hasLines && (
            <span className="label">
              Depth: {depth || '—'}{analyzing && targetDepth ? ` / ${targetDepth}` : ''}
            </span>
          )}
        </div>

        {/* Analyze button */}
        {!analyzing && (
          <button className="btn-primary w-full" onClick={onAnalyze}>
            {hasLines ? 'Re-analyze' : 'Analyze Position'}
          </button>
        )}
        {analyzing && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 13,
              padding: '8px 0',
            }}
          >
            Analyzing{depth ? ` — depth ${depth}` : ''}...
          </div>
        )}

        {/* Move lines */}
        {hasLines && (
          <div className="flex flex-col gap-2">
            {lines.map((line, idx) => (
              <MoveLine
                key={idx}
                line={line}
                rank={idx + 1}
                bestScore={bestScore}
              />
            ))}
          </div>
        )}

        {!hasLines && !analyzing && (
          <div
            style={{
              color: 'var(--text-disabled)',
              fontSize: 13,
              textAlign: 'center',
              padding: '32px 0',
            }}
          >
            Set up a position and click Analyze
          </div>
        )}
      </div>
    </div>
  );
}
