import { Chess } from 'chess.js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Strip { comments }, (variations), NAG symbols, and move annotations
 * from a PGN string so chess.js can parse it cleanly.
 */
function cleanPgn(pgn) {
  let result = '';
  let depth = 0;
  let inCurly = false;

  for (let i = 0; i < pgn.length; i++) {
    const ch = pgn[i];

    if (inCurly) {
      if (ch === '}') inCurly = false;
      continue; // skip everything inside { }
    }

    if (ch === '{') {
      inCurly = true;
      continue;
    }

    if (ch === '(') {
      depth++;
      continue;
    }

    if (ch === ')') {
      if (depth > 0) depth--;
      continue;
    }

    if (depth === 0) {
      result += ch;
    }
  }

  // Remove NAG symbols ($1 $2 ...)
  result = result.replace(/\$\d+/g, ' ');
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Extract SAN moves from clean PGN text (no comments/variations).
 * Returns array of SAN strings.
 */
function extractSanMoves(cleanText) {
  // Remove headers [Tag "value"]
  cleanText = cleanText.replace(/\[\w+\s+"[^"]*"\]/g, '');
  // Remove game result at end
  cleanText = cleanText.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');

  const tokens = cleanText.trim().split(/\s+/);
  const moves = [];

  for (const token of tokens) {
    if (!token) continue;
    // Skip move numbers like "1.", "2...", "10."
    if (/^\d+\.+$/.test(token)) continue;
    // Skip result tokens
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;
    moves.push(token);
  }

  return moves;
}

/**
 * Replay a list of SAN moves from a starting position.
 * Returns array of { fen, san, ply } positions.
 */
function replayMoves(sanMoves, startFen) {
  let game;
  try {
    game = new Chess(startFen || STARTING_FEN);
  } catch {
    game = new Chess();
  }

  const positions = [{ fen: game.fen(), san: null, ply: 0 }];

  for (const san of sanMoves) {
    try {
      game.move(san);
      positions.push({ fen: game.fen(), san, ply: positions.length });
    } catch {
      break; // stop at first invalid move
    }
  }

  return positions;
}

/**
 * Parse a PGN string into an array of positions.
 * Returns { positions, metadata }.
 * Uses three-stage fallback to handle Chess.com/Lichess annotation quirks.
 */
export function parsePgn(pgn) {
  if (!pgn || !pgn.trim()) throw new Error('Empty PGN');

  // Extract metadata tags
  const metadata = {};
  const tagRegex = /\[(\w+)\s+"([^"]+)"\]/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(pgn)) !== null) {
    metadata[tagMatch[1]] = tagMatch[2];
  }

  const startFen = metadata.FEN || STARTING_FEN;

  // Stage 1: try chess.js loadPgn on original PGN
  try {
    const masterGame = new Chess();
    if (masterGame.loadPgn(pgn)) {
      const allMoves = masterGame.history({ verbose: true });
      if (allMoves.length > 0) {
        const positions = replayMoves(allMoves.map(m => m.san), startFen);
        return { positions, metadata };
      }
    }
  } catch {
    // fall through to next stage
  }

  // Stage 2: strip comments/variations, try chess.js loadPgn again
  const cleaned = cleanPgn(pgn);
  try {
    const masterGame = new Chess();
    if (masterGame.loadPgn(cleaned)) {
      const allMoves = masterGame.history({ verbose: true });
      if (allMoves.length > 0) {
        const positions = replayMoves(allMoves.map(m => m.san), startFen);
        return { positions, metadata };
      }
    }
  } catch {
    // fall through to next stage
  }

  // Stage 3: parse and replay moves manually without chess.js PGN loader
  const sanMoves = extractSanMoves(cleaned);
  if (sanMoves.length === 0) throw new Error('No moves found in PGN');

  const positions = replayMoves(sanMoves, startFen);
  if (positions.length <= 1) throw new Error('Could not apply any moves from PGN');

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
