/**
 * Game review: move classification, accuracy scoring.
 */

export const MOVE_CLASS = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#0dcaf0', bg: 'rgba(13,202,240,0.18)' },
  great:     { label: 'Great Move', symbol: '!',  color: '#4c9bff', bg: 'rgba(76,155,255,0.15)' },
  best:      { label: 'Best',       symbol: '★',  color: '#22c55e', bg: 'rgba(34,197,94,0.14)'  },
  excellent: { label: 'Excellent',  symbol: '✓',  color: '#22c55e', bg: 'rgba(34,197,94,0.14)'  },
  good:      { label: 'Good',       symbol: '',   color: '#86c86a', bg: 'rgba(134,200,106,0.12)' },
  book:      { label: 'Book',       symbol: '≡',  color: '#9e9e9e', bg: 'rgba(158,158,158,0.1)' },
  inaccuracy:{ label: 'Inaccuracy', symbol: '?!', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  mistake:   { label: 'Mistake',    symbol: '?',  color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  miss:      { label: 'Miss',       symbol: '✗',  color: '#f44336', bg: 'rgba(239,68,68,0.15)'  },
  blunder:   { label: 'Blunder',    symbol: '??', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
};

/**
 * Classify a move based on centipawn loss (from the moving player's perspective).
 *
 * Thresholds are calibrated for depth-14 Stockfish analysis, where adjacent
 * positions can diverge 30-60cp even for good moves.
 *
 * @param {number} cpLoss          centipawns lost vs. engine best (mover's perspective, >= 0 is bad)
 * @param {number} moverEvalBefore engine eval of the position BEFORE the move (mover's perspective)
 * @param {number} moverEvalAfter  engine eval of the position AFTER the move (mover's perspective)
 * @param {boolean} isBestMove     whether the played move matches the engine's top choice
 * @param {number|null} secondBestGap  how much worse the second-best move was (null if only 1 line)
 * @param {number} ply             ply number (0-indexed; used for book detection)
 * @returns {keyof MOVE_CLASS}
 */
export function classifyMove({ cpLoss, moverEvalBefore, moverEvalAfter, isBestMove, secondBestGap, ply }) {
  // Brilliant: top engine move that dramatically reverses a tough/equal position
  if (
    isBestMove &&
    cpLoss <= 0 &&
    moverEvalBefore < 80 &&
    moverEvalAfter > 200
  ) return 'brilliant';

  // Great: uniquely good move — second best was ≥120cp worse
  if (isBestMove && secondBestGap !== null && secondBestGap >= 120 && cpLoss <= 10) return 'great';

  // Book: opening theory (first 14 ply, small error is normal)
  if (ply <= 14 && cpLoss <= 60) return 'book';

  // Miss: was clearly winning but threw it away
  if (moverEvalBefore > 400 && moverEvalAfter < 100 && cpLoss >= 300) return 'miss';

  if (cpLoss <= 10)  return 'best';
  if (cpLoss <= 25)  return 'excellent';
  if (cpLoss <= 60)  return 'good';
  if (cpLoss <= 150) return 'inaccuracy';
  if (cpLoss <= 400) return 'mistake';
  return 'blunder';
}

/**
 * Map centipawn loss to a per-move accuracy score (0-100).
 * Uses an exponential decay similar to chess.com's CAPS formula.
 */
export function moveAccuracy(cpLoss) {
  // Scale raw Stockfish centipawns to WDL-equivalent units before applying
  // the chess.com CAPS formula (which expects WDL-scale losses, ~1/15th of raw cp)
  const scaled = Math.max(0, cpLoss) / 15;
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * scaled) - 3.1668));
}

/**
 * Compute overall accuracy for one side from an array of cpLoss values.
 */
export function computeAccuracy(cpLosses) {
  if (!cpLosses || cpLosses.length === 0) return null;
  const total = cpLosses.reduce((sum, loss) => sum + moveAccuracy(loss), 0);
  return Math.round(total / cpLosses.length);
}
