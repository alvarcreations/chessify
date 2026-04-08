export default function PositionEditor({ turn, onReset, onClear, onToggleTurn, fen, onFenChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost" onClick={onReset}>
        Reset
      </button>
      <button className="btn-ghost" onClick={onClear}>
        Clear
      </button>
      <button className="btn-ghost" onClick={onToggleTurn}>
        Turn: {turn === 'w' ? 'White' : 'Black'}
      </button>
      <div className="flex-1 min-w-0" style={{ maxWidth: 320 }}>
        <input
          type="text"
          value={fen}
          onChange={(e) => onFenChange(e.target.value)}
          placeholder="Paste FEN string..."
          spellCheck={false}
          style={{
            width: '100%',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--glass-radius-xs)',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
        />
      </div>
    </div>
  );
}
