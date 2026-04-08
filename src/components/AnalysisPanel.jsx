import { formatEval, evalToText, evalColor, getHumannessTag } from '../utils/evaluation';

function MoveLine({ line, rank, bestScore }) {
  const { score, isMate, mateIn, sanMove } = line;
  const evalStr = formatEval(score, isMate, mateIn);
  const evalDesc = evalToText(score, isMate, mateIn);
  const color = evalColor(score, isMate, mateIn);
  const evalDiff = bestScore !== undefined ? score - bestScore : 0;
  const tag = getHumannessTag(sanMove || '', rank, evalDiff);

  return (
    <div
      className="glass-inner flex items-center gap-4"
      style={{
        padding: '16px 18px',
        transition: 'transform var(--transition-fast), background var(--transition-fast)',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Eval color stripe on left edge */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: color,
        borderRadius: '3px 0 0 3px',
        opacity: 0.8,
      }} />

      {/* Rank number */}
      <span
        className="hero-number"
        style={{
          fontSize: 26,
          minWidth: 24,
          textAlign: 'center',
          color: 'var(--text-disabled)',
          marginLeft: 4,
        }}
      >
        {rank}
      </span>

      {/* Move + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span style={{ fontWeight: 600, fontSize: 17, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {sanMove || line.pv?.[0] || '...'}
          </span>
          {tag && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.05)',
                padding: '3px 10px',
                borderRadius: 6,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {tag}
            </span>
          )}
        </div>
        <div className="label" style={{ marginTop: 5, fontSize: 10 }}>
          {evalDesc}
        </div>
      </div>

      {/* Eval hero number */}
      <span
        className="hero-number"
        style={{
          fontSize: 38,
          color,
          minWidth: 90,
          textAlign: 'right',
          lineHeight: 1,
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
    <div className="glass-static flex flex-col" style={{ overflow: 'hidden', minHeight: 400 }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: analyzing ? 'var(--glass-bg-strong)' : 'transparent' }}>
        {analyzing && (
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent)',
              transition: 'width 300ms ease-out',
              boxShadow: '0 0 8px var(--accent-glow)',
            }}
          />
        )}
      </div>

      <div style={{ padding: '24px 24px 28px' }} className="flex flex-col gap-5 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="label" style={{ fontSize: 11 }}>Engine Analysis</span>
          {hasLines && (
            <span className="label">
              Depth {depth || '—'}{analyzing && targetDepth ? ` / ${targetDepth}` : ''}
            </span>
          )}
        </div>

        {/* Analyze button */}
        {!analyzing && (
          <button className="btn-primary w-full" onClick={onAnalyze} style={{ padding: '14px 24px' }}>
            {hasLines ? 'Re-analyze' : 'Analyze Position'}
          </button>
        )}
        {analyzing && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 13,
              padding: '10px 0',
            }}
          >
            <span className="pulse-dot" />
            Analyzing{depth ? ` \u2014 depth ${depth}` : ''}...
          </div>
        )}

        {/* Move lines */}
        {hasLines && (
          <div className="flex flex-col gap-3">
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

        {/* Empty state */}
        {!hasLines && !analyzing && (
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ padding: '24px 0', minHeight: 180 }}
          >
            {/* Decorative chess piece icon */}
            <div style={{
              fontSize: 48,
              color: 'var(--text-disabled)',
              marginBottom: 16,
              opacity: 0.5,
              fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols 2', serif",
            }}>
              {'\u2658'}
            </div>
            <div style={{ color: 'var(--text-disabled)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
              Set up a position and click<br />
              <span style={{ color: 'var(--text-tertiary)' }}>Analyze</span> to see the top 3 engine moves
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
