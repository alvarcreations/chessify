import { Chess } from 'chess.js';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export function isValidFen(fen) {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function fenToBoard(fen) {
  const board = [];
  const placement = fen.split(' ')[0];
  const rows = placement.split('/');

  for (let rank = 0; rank < 8; rank++) {
    const row = [];
    for (const ch of rows[rank]) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch); i++) {
          row.push(null);
        }
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toLowerCase();
        row.push({ type, color });
      }
    }
    board.push(row);
  }
  return board;
}

export function boardToFen(board, turn = 'w', castling = 'KQkq', enPassant = '-', halfmove = 0, fullmove = 1) {
  let placement = '';
  for (let rank = 0; rank < 8; rank++) {
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) {
        empty++;
      } else {
        if (empty > 0) {
          placement += empty;
          empty = 0;
        }
        const ch = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
        placement += ch;
      }
    }
    if (empty > 0) placement += empty;
    if (rank < 7) placement += '/';
  }
  return `${placement} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

/**
 * Attempt to extract and sanitize a FEN string from text that may contain
 * extra words, partial FEN, or formatting issues from an LLM response.
 * Returns a usable FEN string or null if nothing salvageable.
 */
export function sanitizeFen(text) {
  if (!text) return null;

  // Try to find a FEN-like pattern: 8 ranks separated by /
  // Piece placement uses: rnbqkpRNBQKP and digits 1-8
  const fenPlacementRegex = /[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+/;

  const match = text.match(fenPlacementRegex);
  if (!match) return null;

  const placement = match[0];

  // Validate: must be exactly 8 ranks, each summing to 8 squares
  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;

  for (const rank of ranks) {
    let count = 0;
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        count += parseInt(ch);
      } else if (/[rnbqkpRNBQKP]/.test(ch)) {
        count += 1;
      } else {
        return null; // invalid character
      }
    }
    if (count !== 8) return null;
  }

  // Try to extract the rest of the FEN fields from text after placement
  const afterPlacement = text.slice(text.indexOf(placement) + placement.length).trim();
  const parts = afterPlacement.split(/\s+/);

  const turn = (parts[0] === 'w' || parts[0] === 'b') ? parts[0] : 'w';
  const castling = (parts[1] && /^[KQkq-]+$/.test(parts[1])) ? parts[1] : '-';
  const enPassant = (parts[2] && /^[a-h][36]$/.test(parts[2])) ? parts[2] : '-';
  const halfmove = (parts[3] && /^\d+$/.test(parts[3])) ? parts[3] : '0';
  const fullmove = (parts[4] && /^\d+$/.test(parts[4])) ? parts[4] : '1';

  return `${placement} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;
}

export function squareToCoords(square) {
  const file = square.charCodeAt(0) - 97; // a=0
  const rank = 8 - parseInt(square[1]);    // 8=0, 1=7
  return { rank, file };
}

export function coordsToSquare(rank, file) {
  return String.fromCharCode(97 + file) + (8 - rank);
}
