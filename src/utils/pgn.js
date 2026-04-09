import { Chess } from 'chess.js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Parse a PGN string into an array of positions.
 * Returns { positions, metadata } where positions is an array of { fen, san, ply }.
 */
export function parsePgn(pgn) {
  // Extract metadata tags
  const metadata = {};
  const tagRegex = /\[(\w+)\s+"([^"]+)"\]/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(pgn)) !== null) {
    metadata[tagMatch[1]] = tagMatch[2];
  }

  // Load PGN with chess.js to extract moves
  const masterGame = new Chess();
  const success = masterGame.loadPgn(pgn);
  if (!success) throw new Error('Invalid PGN — could not parse moves');

  const allMoves = masterGame.history({ verbose: true });

  // Determine starting position
  const startFen = metadata.FEN || STARTING_FEN;

  // Replay from start, collecting FEN at each step
  let replayGame;
  try {
    replayGame = new Chess(startFen);
  } catch {
    replayGame = new Chess();
  }

  const positions = [{ fen: replayGame.fen(), san: null, ply: 0 }];

  for (const move of allMoves) {
    try {
      replayGame.move(move.san);
      positions.push({ fen: replayGame.fen(), san: move.san, ply: positions.length });
    } catch {
      break; // stop at invalid move
    }
  }

  return { positions, metadata };
}

/**
 * Check whether a string looks like a PGN.
 */
export function looksLikePgn(text) {
  return text.includes('[Event ') || /^\s*1\.\s/.test(text) || /\[\w+\s+"/.test(text);
}

/**
 * Fetch recent games for a Chess.com player for a given month.
 * Returns array of game objects with pgn, white, black, url, time_control, end_time.
 */
export async function fetchChessComGames(username, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${year}/${monthStr}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error(`Player "${username}" not found on Chess.com`);
    throw new Error(`Chess.com error: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const games = data.games || [];
  // Most recent first
  return games.reverse();
}

/**
 * Fetch a single Lichess game by URL or game ID and return its PGN.
 */
export async function fetchLichessGame(urlOrId) {
  let gameId = urlOrId.trim();
  const match = urlOrId.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
  if (match) gameId = match[1];
  // Strip any extra path (like /black, /white)
  gameId = gameId.replace(/\/.*$/, '');

  const url = `https://lichess.org/game/export/${gameId}`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/x-chess-pgn' },
  });

  if (!resp.ok) {
    throw new Error(`Lichess game not found (${resp.status})`);
  }

  return await resp.text();
}

/**
 * Format game result for display.
 */
export function formatGameResult(white, black) {
  const wr = white?.result;
  if (wr === 'win') return '1-0';
  if (wr === 'checkmated' || wr === 'resigned' || wr === 'timeout' || wr === 'abandoned') return '0-1';
  return '½-½';
}

/**
 * Format time control for display.
 */
export function formatTimeControl(tc) {
  if (!tc) return '';
  const [base, inc] = tc.split('+');
  const mins = Math.floor(parseInt(base) / 60);
  return inc && inc !== '0' ? `${mins}+${inc}` : `${mins} min`;
}
