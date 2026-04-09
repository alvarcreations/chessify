import { useState } from 'react';
import { parsePgn, looksLikePgn, fetchChessComGames, fetchLichessGame, formatGameResult, formatTimeControl } from '../utils/pgn';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function GameRow({ game, onLoad }) {
  const w = game.white;
  const b = game.black;
  const result = formatGameResult(w, b);
  const tc = formatTimeControl(game.time_control);
  const date = game.end_time ? new Date(game.end_time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  return (
    <div
      className="glass-inner"
      style={{ padding: '10px 14px', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
      onClick={onLoad}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {w?.username} ({w?.rating}) vs {b?.username} ({b?.rating})
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 2 }}>
            {tc}{tc && date ? ' · ' : ''}{date}
          </div>
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: result === '1-0' ? 'var(--color-good)' : result === '0-1' ? 'var(--color-bad)' : 'var(--color-equal)',
          minWidth: 36,
          textAlign: 'right',
        }}>
          {result}
        </div>
      </div>
    </div>
  );
}

export default function GameImport({ onGameLoaded }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [games, setGames] = useState([]);
  const [showGames, setShowGames] = useState(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const isLichessUrl = input.includes('lichess.org/');
  const isPgn = looksLikePgn(input);
  const mode = isPgn ? 'pgn' : isLichessUrl ? 'lichess' : 'chesscom';

  async function handleFetch() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setGames([]);
    setShowGames(false);

    try {
      if (mode === 'pgn') {
        // Direct PGN paste
        const { positions, metadata } = parsePgn(trimmed);
        onGameLoaded(positions, metadata);
      } else if (mode === 'lichess') {
        const pgn = await fetchLichessGame(trimmed);
        const { positions, metadata } = parsePgn(pgn);
        onGameLoaded(positions, metadata);
      } else {
        // Chess.com username — fetch game list
        const fetched = await fetchChessComGames(trimmed, year, month);
        if (fetched.length === 0) {
          setError(`No games found for ${MONTHS[month - 1]} ${year}`);
        } else {
          setGames(fetched);
          setShowGames(true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function loadGame(game) {
    try {
      const { positions, metadata } = parsePgn(game.pgn);
      onGameLoaded(positions, metadata);
      setShowGames(false);
    } catch (err) {
      setError(err.message);
    }
  }

  const placeholder = 'Chess.com username, Lichess game URL, or paste PGN';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowGames(false); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--glass-radius-xs)',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            minWidth: 0,
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
        />
        <button
          className="btn-ghost"
          onClick={handleFetch}
          disabled={loading || !input.trim()}
          style={{ whiteSpace: 'nowrap', opacity: loading || !input.trim() ? 0.4 : 1 }}
        >
          {loading ? '...' : 'Load'}
        </button>
      </div>

      {/* Month/year selector only for Chess.com username mode */}
      {mode === 'chesscom' && input.trim() && !isPgn && (
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          <span className="label" style={{ fontSize: 10 }}>Month:</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 6,
              padding: '4px 8px',
              color: 'var(--text-primary)',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 6,
              padding: '4px 8px',
              color: 'var(--text-primary)',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {Array.from({ length: 10 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--color-bad)', fontSize: 12, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Game list */}
      {showGames && games.length > 0 && (
        <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <div className="label" style={{ fontSize: 10, marginBottom: 4 }}>
            {games.length} game{games.length !== 1 ? 's' : ''} — click to load
          </div>
          {games.slice(0, 30).map((game, idx) => (
            <GameRow key={idx} game={game} onLoad={() => loadGame(game)} />
          ))}
        </div>
      )}
    </div>
  );
}
