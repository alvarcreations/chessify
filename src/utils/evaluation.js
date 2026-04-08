/**
 * Convert centipawn score to human-readable description.
 */
export function evalToText(cp, isMate = false, mateIn = 0) {
  if (isMate) {
    if (mateIn > 0) return `Mate in ${mateIn}`;
    if (mateIn < 0) return `Mated in ${Math.abs(mateIn)}`;
    return 'Checkmate';
  }

  const abs = Math.abs(cp);
  const side = cp > 0 ? 'White' : 'Black';

  if (abs <= 15) return 'Dead equal';
  if (abs <= 50) return 'Roughly equal';
  if (abs <= 100) return `${side} is slightly better`;
  if (abs <= 200) return `${side} has an edge`;
  if (abs <= 350) return `${side} is clearly better`;
  if (abs <= 600) return `${side} is winning`;
  return `${side} is decisively winning`;
}

/**
 * Format centipawn score as display string (e.g. "+1.2", "-0.5", "M3")
 */
export function formatEval(cp, isMate = false, mateIn = 0) {
  if (isMate) {
    return mateIn > 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
  }
  const val = (cp / 100).toFixed(1);
  return cp > 0 ? `+${val}` : val;
}

/**
 * Get semantic color class for evaluation.
 * Positive from perspective of the side to move.
 */
export function evalColorClass(cp, isMate = false, mateIn = 0) {
  if (isMate) {
    return mateIn > 0 ? 'eval-good' : 'eval-bad';
  }
  const abs = Math.abs(cp);
  if (abs <= 50) return 'eval-equal';
  return cp > 0 ? 'eval-good' : 'eval-bad';
}

/**
 * Get CSS color value for evaluation.
 */
export function evalColor(cp, isMate = false, mateIn = 0) {
  if (isMate) {
    return mateIn > 0 ? 'var(--color-good)' : 'var(--color-bad)';
  }
  const abs = Math.abs(cp);
  if (abs <= 50) return 'var(--color-equal)';
  return cp > 0 ? 'var(--color-good)' : 'var(--color-bad)';
}

/**
 * Simple "humanness" heuristic for a move.
 * Tags 2nd/3rd best moves to feel more natural.
 */
export function getHumannessTag(move, rank, evalDiff) {
  if (rank === 1) return null; // Best move gets no tag

  // Parse the SAN move
  const isCapture = move.includes('x');
  const isCheck = move.includes('+') || move.includes('#');
  const isCastle = move === 'O-O' || move === 'O-O-O';
  const isPawnMove = move[0] === move[0].toLowerCase() && !isCastle;
  const isMinorPieceDev = /^[NB][a-h]?[1-8]?[a-h][1-8]/.test(move) && !isCapture;

  // Score difference from best move (in centipawns)
  const cpDiff = Math.abs(evalDiff);

  if (cpDiff < 15) return 'Nearly as strong';
  if (isCastle) return 'Natural development';
  if (isMinorPieceDev && !isCheck) return 'Looks natural';
  if (isPawnMove && !isCapture) return 'Solid choice';
  if (isCapture && cpDiff < 40) return 'Common in GM games';
  if (cpDiff < 30) return 'Very playable';
  if (cpDiff < 60) return 'Reasonable alternative';
  return 'Interesting sideline';
}
