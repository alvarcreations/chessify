import { formatEval } from '../utils/evaluation';

function evalToPercent(cp, isMate, mateIn) {
  if (isMate) return mateIn > 0 ? 100 : 0;
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.004 * clamped)) - 1);
}

export default function EvalBar({ cp = 0, isMate = false, mateIn = 0, visible = false }) {
  const whitePercent = visible ? evalToPercent(cp, isMate, mateIn) : 50;
  const evalStr = visible ? formatEval(cp, isMate, mateIn) : '';
  const isWhiteFavored = cp > 0 || (isMate && mateIn > 0);

  return (
    <div
      style={{
        width: 28,
        minWidth: 28,
        borderRadius: 'var(--glass-radius-sm)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--glass-border)',
        alignSelf: 'stretch',
      }}
    >
      {/* Black region (top) */}
      <div
        style={{
          flex: `${100 - whitePercent} 0 0%`,
          background: 'rgba(255, 255, 255, 0.06)',
          transition: 'flex 500ms ease-out',
          minHeight: 2,
        }}
      />

      {/* White region (bottom) */}
      <div
        style={{
          flex: `${whitePercent} 0 0%`,
          background: 'rgba(255, 255, 255, 0.82)',
          transition: 'flex 500ms ease-out',
          minHeight: 2,
        }}
      />

      {/* Eval label — positioned at the divider */}
      {visible && evalStr && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: `${100 - whitePercent}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 9,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.02em',
            color: isWhiteFavored ? '#000' : 'rgba(255,255,255,0.9)',
            background: isWhiteFavored ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)',
            padding: '2px 4px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            lineHeight: 1,
            transition: 'top 500ms ease-out',
            pointerEvents: 'none',
          }}
        >
          {evalStr}
        </div>
      )}
    </div>
  );
}
