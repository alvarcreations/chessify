import { useEffect, useRef } from 'react';
import { MOVE_CLASS } from '../utils/review';

function ClassificationHero({ cls }) {
  const info = MOVE_CLASS[cls];
  if (!info) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 18px',
      background: info.bg,
      borderRadius: 'var(--glass-radius-sm)',
      border: `1px solid ${info.color}30`,
    }}>
      {info.symbol && (
        <span style={{ fontSize: 22, fontWeight: 700, color: info.color, minWidth: 28, textAlign: 'center', lineHeight: 1 }}>
          {info.symbol}
        </span>
      )}
      <span style={{ fontSize: 15, fontWeight: 600, color: info.color }}>
        {info.label}
      </span>
    </div>
  );
}

function AccuracyBar({ label, accuracy, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>
          {accuracy != null ? `${accuracy}%` : '—'}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${accuracy ?? 0}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 400ms ease-out',
        }} />
      </div>
    </div>
  );
}

function MoveBadge({ san, cls, isActive, onClick }) {
  if (!san) return null;
  const info = cls ? MOVE_CLASS[cls] : null;
  return (
    <button
      onClick={onClick}
      style={{
        background: isActive ? 'rgba(124,92,252,0.2)' : 'transparent',
        border: isActive ? '1px solid rgba(124,92,252,0.4)' : '1px solid transparent',
        borderRadius: 4,
        padding: '2px 6px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        transition: 'background var(--transition-fast)',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {san}
      {info?.symbol && (
        <span style={{ fontSize: 9, fontWeight: 700, color: info.color }}>{info.symbol}</span>
      )}
    </button>
  );
}

export default function ReviewPanel({
  ply,
  positions,
  review,          // array of review data per ply (null at index 0)
  reviewAnalyzing,
  reviewProgress,
  onReview,
  onJumpToPly,
  whiteAccuracy,
  blackAccuracy,
}) {
  const listRef = useRef(null);
  const hasReview = review && review.length > 0;
  const currentReview = ply > 0 && hasReview ? review[ply] : null;

  // Auto-scroll move list to keep current move visible
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [ply]);

  // Build move pair rows
  const movePairs = [];
  if (positions) {
    for (let i = 1; i < positions.length; i += 2) {
      const whitePos = positions[i];
      const blackPos = positions[i + 1] ?? null;
      movePairs.push({
        num: Math.ceil(i / 2),
        whitePly: i,
        whiteSan: whitePos.san,
        whiteClass: hasReview ? review[i]?.classification : null,
        blackPly: blackPos ? i + 1 : null,
        blackSan: blackPos?.san ?? null,
        blackClass: hasReview && blackPos ? review[i + 1]?.classification : null,
      });
    }
  }

  return (
    <div className="glass-static flex flex-col" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="label" style={{ fontSize: 11 }}>Game Review</span>
          {!reviewAnalyzing && (
            <button
              className="btn-ghost"
              onClick={onReview}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              {hasReview ? 'Re-review' : 'Review Game'}
            </button>
          )}
        </div>

        {/* Progress bar while analyzing */}
        {reviewAnalyzing && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span className="pulse-dot" /> Analyzing positions…
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                {Math.round(reviewProgress * 100)}%
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--glass-bg-strong)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${reviewProgress * 100}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 200ms ease-out',
                boxShadow: '0 0 8px var(--accent-glow)',
              }} />
            </div>
          </div>
        )}

        {/* Accuracy scores */}
        {hasReview && whiteAccuracy != null && (
          <div style={{ display: 'flex', gap: 20 }}>
            <AccuracyBar label="White" accuracy={whiteAccuracy} color="rgba(255,255,255,0.85)" />
            <AccuracyBar label="Black" accuracy={blackAccuracy} color="rgba(100,100,100,0.9)" />
          </div>
        )}

        {/* Current move classification */}
        {currentReview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ClassificationHero cls={currentReview.classification} />

            {/* Eval change */}
            <div style={{ display: 'flex', gap: 16, paddingLeft: 4 }}>
              <div>
                <div className="label" style={{ fontSize: 9, marginBottom: 3 }}>BEFORE</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentReview.evalBefore >= 0 ? '+' : ''}{(currentReview.evalBefore / 100).toFixed(1)}
                </span>
              </div>
              <div style={{ color: 'var(--text-disabled)', alignSelf: 'flex-end', fontSize: 12 }}>→</div>
              <div>
                <div className="label" style={{ fontSize: 9, marginBottom: 3 }}>AFTER</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentReview.evalAfter >= 0 ? '+' : ''}{(currentReview.evalAfter / 100).toFixed(1)}
                </span>
              </div>
              {currentReview.cpLoss > 5 && (
                <div style={{ marginLeft: 'auto' }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 3 }}>LOSS</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: MOVE_CLASS[currentReview.classification]?.color }}>
                    -{(currentReview.cpLoss / 100).toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Best alternative */}
            {currentReview.bestSan && currentReview.bestSan !== currentReview.playedSan && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(34,197,94,0.08)',
                borderRadius: 'var(--glass-radius-xs)',
                border: '1px solid rgba(34,197,94,0.15)',
              }}>
                <span className="label" style={{ fontSize: 9 }}>BETTER WAS</span>
                <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: '#22c55e' }}>
                  {currentReview.bestSan}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasReview && !reviewAnalyzing && (
          <div style={{ color: 'var(--text-disabled)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
            Click "Review Game" to classify all moves
          </div>
        )}
      </div>

      {/* Move list */}
      {positions && positions.length > 1 && (
        <>
          <div className="divider" style={{ margin: '0' }} />
          <div
            ref={listRef}
            style={{ overflowY: 'auto', maxHeight: 260, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {movePairs.map((pair) => (
              <div key={pair.num} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-disabled)', minWidth: 22, textAlign: 'right', marginRight: 2 }}>
                  {pair.num}.
                </span>
                <span data-active={ply === pair.whitePly ? 'true' : 'false'}>
                  <MoveBadge
                    san={pair.whiteSan}
                    cls={pair.whiteClass}
                    isActive={ply === pair.whitePly}
                    onClick={() => onJumpToPly(pair.whitePly)}
                  />
                </span>
                {pair.blackSan && (
                  <span data-active={ply === pair.blackPly ? 'true' : 'false'}>
                    <MoveBadge
                      san={pair.blackSan}
                      cls={pair.blackClass}
                      isActive={ply === pair.blackPly}
                      onClick={() => onJumpToPly(pair.blackPly)}
                    />
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
