import { useMemo } from 'react';
import { coordsToSquare } from '../utils/fen';

const BOARD_SIZE = 600;
const SQUARE_SIZE = BOARD_SIZE / 8;

// Unicode chess pieces — crisp at any size, always available
const PIECE_CHARS = {
  wk: '\u2654', wq: '\u2655', wr: '\u2656', wb: '\u2657', wn: '\u2658', wp: '\u2659',
  bk: '\u265A', bq: '\u265B', br: '\u265C', bb: '\u265D', bn: '\u265E', bp: '\u265F',
};

function getPieceKey(piece) {
  if (!piece) return null;
  return piece.color + piece.type;
}

function MoveArrow({ from, to, opacity }) {
  const fromX = from.file * SQUARE_SIZE + SQUARE_SIZE / 2;
  const fromY = from.rank * SQUARE_SIZE + SQUARE_SIZE / 2;
  const toX = to.file * SQUARE_SIZE + SQUARE_SIZE / 2;
  const toY = to.rank * SQUARE_SIZE + SQUARE_SIZE / 2;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const headLen = 14;

  // Shorten arrow so head doesn't overlap piece center
  const shortenBy = SQUARE_SIZE * 0.3;
  const ratio = (len - shortenBy) / len;
  const endX = fromX + dx * ratio;
  const endY = fromY + dy * ratio;

  const angle = Math.atan2(dy, dx);
  const headAngle = Math.PI / 6;

  const h1x = endX - headLen * Math.cos(angle - headAngle);
  const h1y = endY - headLen * Math.sin(angle - headAngle);
  const h2x = endX - headLen * Math.cos(angle + headAngle);
  const h2y = endY - headLen * Math.sin(angle + headAngle);

  return (
    <g opacity={opacity} style={{ transition: 'opacity 200ms ease-out' }}>
      <line
        x1={fromX}
        y1={fromY}
        x2={endX}
        y2={endY}
        stroke="var(--accent)"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <polygon
        points={`${endX},${endY} ${h1x},${h1y} ${h2x},${h2y}`}
        fill="var(--accent)"
      />
    </g>
  );
}

export default function Board({
  board,
  selectedSquare,
  legalMoves = [],
  arrows = [],
  onSquareClick,
}) {
  const squares = useMemo(() => {
    const result = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const isLight = (rank + file) % 2 === 0;
        const square = coordsToSquare(rank, file);
        const isSelected = selectedSquare === square;
        const isLegalTarget = legalMoves.includes(square);
        const piece = board[rank]?.[file];

        result.push({
          rank, file, isLight, square, isSelected, isLegalTarget, piece,
        });
      }
    }
    return result;
  }, [board, selectedSquare, legalMoves]);

  const fileLabels = 'abcdefgh';
  const rankLabels = '87654321';

  return (
    <div className="board-container">
      <svg
        viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
        width="100%"
        style={{ maxWidth: BOARD_SIZE, display: 'block' }}
      >
        {/* Board squares */}
        {squares.map(({ rank, file, isLight, square, isSelected, isLegalTarget, piece }) => {
          const x = file * SQUARE_SIZE;
          const y = rank * SQUARE_SIZE;
          const cx = x + SQUARE_SIZE / 2;
          const cy = y + SQUARE_SIZE / 2;
          const key = piece ? getPieceKey(piece) : null;

          return (
            <g key={square}>
              <rect
                x={x}
                y={y}
                width={SQUARE_SIZE}
                height={SQUARE_SIZE}
                fill={
                  isSelected
                    ? 'var(--board-selected)'
                    : isLight
                      ? 'var(--board-light)'
                      : 'var(--board-dark)'
                }
                onClick={() => onSquareClick?.(square, rank, file)}
                style={{ cursor: 'pointer' }}
              />

              {/* Selected square glow */}
              {isSelected && (
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={SQUARE_SIZE - 2}
                  height={SQUARE_SIZE - 2}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  opacity={0.5}
                  rx={2}
                  pointerEvents="none"
                />
              )}

              {/* Legal move indicator */}
              {isLegalTarget && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={piece ? SQUARE_SIZE * 0.45 : SQUARE_SIZE * 0.15}
                  fill={piece ? 'none' : 'var(--board-legal)'}
                  stroke={piece ? 'var(--board-legal)' : 'none'}
                  strokeWidth={piece ? 3 : 0}
                  pointerEvents="none"
                />
              )}

              {/* Piece — rendered as Unicode text */}
              {key && (
                <>
                  {/* Shadow layer for depth */}
                  <text
                    x={cx + 1}
                    y={cy + 3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={SQUARE_SIZE * 0.78}
                    fontFamily="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif"
                    fill="rgba(0,0,0,0.5)"
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  >
                    {PIECE_CHARS[key]}
                  </text>
                  {/* Main piece */}
                  <text
                    x={cx}
                    y={cy + 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={SQUARE_SIZE * 0.78}
                    fontFamily="'Segoe UI Symbol', 'Noto Sans Symbols 2', serif"
                    fill={piece.color === 'w' ? '#f0f0f0' : '#8a8a8a'}
                    stroke={piece.color === 'w' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.7)'}
                    strokeWidth={0.8}
                    paintOrder="stroke"
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  >
                    {PIECE_CHARS[key]}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Coordinate labels */}
        {fileLabels.split('').map((f, i) => (
          <text
            key={`file-${f}`}
            x={i * SQUARE_SIZE + SQUARE_SIZE - 5}
            y={BOARD_SIZE - 4}
            fill="var(--text-tertiary)"
            fontSize="10"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            textAnchor="end"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em', userSelect: 'none' }}
          >
            {f}
          </text>
        ))}
        {rankLabels.split('').map((r, i) => (
          <text
            key={`rank-${r}`}
            x={4}
            y={i * SQUARE_SIZE + 14}
            fill="var(--text-tertiary)"
            fontSize="10"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
            style={{ textTransform: 'uppercase', letterSpacing: '0.08em', userSelect: 'none' }}
          >
            {r}
          </text>
        ))}

        {/* Move arrows overlay */}
        {arrows.map((arrow, idx) => (
          <MoveArrow
            key={`arrow-${idx}`}
            from={arrow.from}
            to={arrow.to}
            opacity={arrow.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
