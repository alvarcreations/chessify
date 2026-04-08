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

export function squareToCoords(square) {
  const file = square.charCodeAt(0) - 97; // a=0
  const rank = 8 - parseInt(square[1]);    // 8=0, 1=7
  return { rank, file };
}

export function coordsToSquare(rank, file) {
  return String.fromCharCode(97 + file) + (8 - rank);
}
