const PIECE_CHARS = {
  wk: '\u2654', wq: '\u2655', wr: '\u2656', wb: '\u2657', wn: '\u2658', wp: '\u2659',
  bk: '\u265A', bq: '\u265B', br: '\u265C', bb: '\u265D', bn: '\u265E', bp: '\u265F',
};

const PIECES = [
  { key: 'wk', color: 'w', type: 'k' },
  { key: 'wq', color: 'w', type: 'q' },
  { key: 'wr', color: 'w', type: 'r' },
  { key: 'wb', color: 'w', type: 'b' },
  { key: 'wn', color: 'w', type: 'n' },
  { key: 'wp', color: 'w', type: 'p' },
  { key: 'bk', color: 'b', type: 'k' },
  { key: 'bq', color: 'b', type: 'q' },
  { key: 'br', color: 'b', type: 'r' },
  { key: 'bb', color: 'b', type: 'b' },
  { key: 'bn', color: 'b', type: 'n' },
  { key: 'bp', color: 'b', type: 'p' },
];

function getActiveKey(placingPiece) {
  if (!placingPiece || placingPiece === 'eraser') return null;
  return placingPiece.color + placingPiece.type;
}

export default function PiecePalette({ placingPiece, onSelect }) {
  const activeKey = getActiveKey(placingPiece);
  const isEraser = placingPiece === 'eraser';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '6px 8px',
    }}>
      <span className="label" style={{ fontSize: 10, marginRight: 6, whiteSpace: 'nowrap' }}>Place</span>

      {/* White pieces */}
      {PIECES.slice(0, 6).map(({ key, color, type }) => {
        const isActive = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(isActive ? null : { color, type })}
            title={`Place white ${type === 'k' ? 'king' : type === 'q' ? 'queen' : type === 'r' ? 'rook' : type === 'b' ? 'bishop' : type === 'n' ? 'knight' : 'pawn'}`}
            style={{
              background: isActive ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 24,
              fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols 2', serif",
              color: isActive ? '#fff' : '#f5f5f5',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              transition: 'background var(--transition-fast)',
              userSelect: 'none',
            }}
          >
            {PIECE_CHARS[key]}
          </button>
        );
      })}

      {/* Separator */}
      <div style={{
        width: 1,
        height: 24,
        background: 'var(--glass-border)',
        margin: '0 4px',
      }} />

      {/* Black pieces */}
      {PIECES.slice(6).map(({ key, color, type }) => {
        const isActive = activeKey === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(isActive ? null : { color, type })}
            title={`Place black ${type === 'k' ? 'king' : type === 'q' ? 'queen' : type === 'r' ? 'rook' : type === 'b' ? 'bishop' : type === 'n' ? 'knight' : 'pawn'}`}
            style={{
              background: isActive ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 24,
              fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols 2', serif",
              color: isActive ? '#fff' : '#1a1a1a',
              textShadow: isActive ? 'none' : '0 0 3px rgba(255,255,255,0.15)',
              transition: 'background var(--transition-fast)',
              userSelect: 'none',
            }}
          >
            {PIECE_CHARS[key]}
          </button>
        );
      })}

      {/* Separator */}
      <div style={{
        width: 1,
        height: 24,
        background: 'var(--glass-border)',
        margin: '0 4px',
      }} />

      {/* Eraser tool */}
      <button
        onClick={() => onSelect(isEraser ? null : 'eraser')}
        title="Remove pieces from the board"
        style={{
          background: isEraser ? 'var(--color-bad)' : 'transparent',
          border: 'none',
          borderRadius: 6,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 16,
          color: isEraser ? '#fff' : 'var(--text-secondary)',
          transition: 'background var(--transition-fast)',
          userSelect: 'none',
        }}
      >
        ✕
      </button>
    </div>
  );
}
