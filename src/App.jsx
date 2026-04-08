import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from './components/Board';
import AnalysisPanel from './components/AnalysisPanel';
import PositionEditor from './components/PositionEditor';
import ScreenshotImport from './components/ScreenshotImport';
import { StockfishEngine } from './engine/stockfish';
import { STARTING_FEN, EMPTY_FEN, fenToBoard, boardToFen, squareToCoords, isValidFen, sanitizeFen } from './utils/fen';

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [board, setBoard] = useState(() => fenToBoard(STARTING_FEN));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [turn, setTurn] = useState('w');
  const [fen, setFen] = useState(STARTING_FEN);

  // Analysis state
  const [lines, setLines] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [depth, setDepth] = useState(0);
  const [targetDepth] = useState(22);
  const [arrows, setArrows] = useState([]);

  // Engine ref
  const engineRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);

  // API key — persist in localStorage
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('chessify-api-key') || '');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('chessify-api-key', key);
    } else {
      localStorage.removeItem('chessify-api-key');
    }
  }, []);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine.init().then(() => {
      setEngineReady(true);
    }).catch((err) => {
      console.error('Failed to init Stockfish:', err);
    });

    return () => engine.destroy();
  }, []);

  // Sync game state helper
  const syncFromFen = useCallback((newFen) => {
    try {
      const newGame = new Chess(newFen);
      setGame(newGame);
      setBoard(fenToBoard(newFen));
      setTurn(newGame.turn());
      setFen(newFen);
      setSelectedSquare(null);
      setLegalMoves([]);
      setLines([]);
      setArrows([]);
      setAnalyzing(false);
    } catch {
      // Invalid FEN, ignore
    }
  }, []);

  // Sync state from a board array (board is source of truth for setup)
  const syncFromBoard = useCallback((newBoard, newTurn) => {
    const t = newTurn || turn;
    const newFen = boardToFen(newBoard, t);
    setBoard(newBoard);
    setFen(newFen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLines([]);
    setArrows([]);
    setAnalyzing(false);
    // Try to sync chess.js — may fail for illegal positions, that's fine
    try {
      setGame(new Chess(newFen));
    } catch {
      // Illegal position for chess.js, board array is still valid
    }
  }, [turn]);

  // Free-form square click: pick up any piece, place it anywhere
  const handleSquareClick = useCallback((square, rank, file) => {
    if (selectedSquare) {
      // Clicked the same square — deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Move the selected piece to this square (free-form, no legality check)
      const fromCoords = squareToCoords(selectedSquare);
      const newBoard = board.map(r => [...r]);
      const piece = newBoard[fromCoords.rank][fromCoords.file];

      if (piece) {
        newBoard[fromCoords.rank][fromCoords.file] = null;
        newBoard[rank][file] = piece;
        syncFromBoard(newBoard);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
    }

    // No selection — select any piece on the clicked square
    const piece = board[rank]?.[file];
    if (piece) {
      setSelectedSquare(square);
      // No legal move dots in free-form mode — all squares are valid targets
      setLegalMoves([]);
    }
  }, [selectedSquare, board, syncFromBoard]);

  // Convert UCI move (e.g. "e2e4") to SAN notation
  const uciToSan = useCallback((uciMove, currentFen) => {
    try {
      const tempGame = new Chess(currentFen);
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
      const move = tempGame.move({ from, to, promotion });
      return move ? move.san : uciMove;
    } catch {
      return uciMove;
    }
  }, []);

  // Build arrows from analysis lines
  const updateArrows = useCallback((analysisLines) => {
    const opacities = [0.8, 0.45, 0.25];
    const newArrows = analysisLines.slice(0, 3).map((line, idx) => {
      const uci = line.pv[0];
      const from = squareToCoords(uci.slice(0, 2));
      const to = squareToCoords(uci.slice(2, 4));
      return { from, to, opacity: opacities[idx] || 0.2 };
    });
    setArrows(newArrows);
  }, []);

  // Analyze position
  const handleAnalyze = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engineReady) return;

    setAnalyzing(true);
    setLines([]);
    setArrows([]);
    setDepth(0);

    // Use boardToFen as source of truth — game.fen() may be stale for illegal positions
    const currentFen = boardToFen(board, turn);

    engine.onProgress = ({ depth: d, lines: progressLines }) => {
      setDepth(d);
      if (progressLines && progressLines.length > 0) {
        const withSan = progressLines.map((line) => ({
          ...line,
          sanMove: uciToSan(line.pv[0], currentFen),
        }));
        setLines(withSan);
        updateArrows(withSan);
      }
    };

    engine.onAnalysis = (finalLines) => {
      setAnalyzing(false);
      if (finalLines && finalLines.length > 0) {
        const withSan = finalLines.map((line) => ({
          ...line,
          sanMove: uciToSan(line.pv[0], currentFen),
        }));
        setLines(withSan);
        updateArrows(withSan);
      }
    };

    engine.analyze(currentFen, targetDepth, 3);
  }, [game, engineReady, targetDepth, uciToSan, updateArrows]);

  // Position editor callbacks
  const handleReset = useCallback(() => syncFromFen(STARTING_FEN), [syncFromFen]);

  const handleClear = useCallback(() => syncFromFen(EMPTY_FEN), [syncFromFen]);

  const handleToggleTurn = useCallback(() => {
    const newTurn = turn === 'w' ? 'b' : 'w';
    setTurn(newTurn);
    const newFen = boardToFen(board, newTurn);
    setFen(newFen);
    try {
      setGame(new Chess(newFen));
    } catch {
      // fine for illegal positions
    }
  }, [turn, board]);

  const handleFenChange = useCallback((newFen) => {
    setFen(newFen);
    if (isValidFen(newFen)) {
      syncFromFen(newFen);
    }
  }, [syncFromFen]);

  const handleFenDetected = useCallback((detectedFen) => {
    // First try strict chess.js parsing
    if (isValidFen(detectedFen)) {
      syncFromFen(detectedFen);
      return;
    }
    // Fall back to sanitizing — extract placement, fill defaults
    const cleaned = sanitizeFen(detectedFen);
    if (cleaned) {
      const newBoard = fenToBoard(cleaned);
      const newTurn = cleaned.split(' ')[1] || 'w';
      setBoard(newBoard);
      setFen(cleaned);
      setTurn(newTurn);
      setSelectedSquare(null);
      setLegalMoves([]);
      setLines([]);
      setArrows([]);
      try {
        setGame(new Chess(cleaned));
      } catch {
        // Illegal position for chess.js — board still loaded
      }
    }
  }, [syncFromFen]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-primary)' }}>
            Chessify
          </h1>
          <span className="label" style={{ marginTop: 2 }}>Position Analyzer</span>
        </div>
        <button
          className="btn-ghost"
          onClick={() => setShowApiKey(!showApiKey)}
          style={{ fontSize: 12 }}
        >
          {apiKey ? 'API Key Set' : 'Set API Key'}
        </button>
      </header>

      {/* API Key input */}
      {showApiKey && (
        <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex items-center gap-3" style={{ maxWidth: 500 }}>
            <span className="label" style={{ whiteSpace: 'nowrap' }}>Anthropic API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                flex: 1,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--glass-radius-xs)',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="app-layout mx-auto" style={{ maxWidth: 1100 }}>
          {/* Left: Board + controls */}
          <div className="flex flex-col gap-4">
            <div className="glass-static" style={{ padding: 12 }}>
              <Board
                board={board}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                arrows={arrows}
                onSquareClick={handleSquareClick}
              />
            </div>

            <PositionEditor
              turn={turn}
              onReset={handleReset}
              onClear={handleClear}
              onToggleTurn={handleToggleTurn}
              fen={fen}
              onFenChange={handleFenChange}
            />

            <ScreenshotImport
              onFenDetected={handleFenDetected}
              apiKey={apiKey}
            />
          </div>

          {/* Right: Analysis panel */}
          <AnalysisPanel
            lines={lines}
            depth={depth}
            targetDepth={targetDepth}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
          />
        </div>
      </main>
    </div>
  );
}
