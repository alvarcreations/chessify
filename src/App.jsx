import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from './components/Board';
import AnalysisPanel from './components/AnalysisPanel';
import EvalBar from './components/EvalBar';
import ScreenshotImport from './components/ScreenshotImport';
import GameImport from './components/GameImport';
import PiecePalette from './components/PiecePalette';
import { StockfishEngine } from './engine/stockfish';
import { STARTING_FEN, EMPTY_FEN, fenToBoard, boardToFen, squareToCoords, isValidFen, sanitizeFen } from './utils/fen';
import { playMoveSound, playCaptureSound, playUndoSound } from './utils/sound';

const MAX_HISTORY = 50;

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [board, setBoard] = useState(() => fenToBoard(STARTING_FEN));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [turn, setTurn] = useState('w');
  const [fen, setFen] = useState(STARTING_FEN);
  const [flipped, setFlipped] = useState(false);

  // Undo history — stores FEN strings
  const [history, setHistory] = useState([]);

  // Analysis state
  const [lines, setLines] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [depth, setDepth] = useState(0);
  const [targetDepth] = useState(22);
  const [arrows, setArrows] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);

  // Engine ref
  const engineRef = useRef(null);
  const [engineReady, setEngineReady] = useState(false);

  // API key
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('chessify-api-key') || '');
  const [showApiKey, setShowApiKey] = useState(false);

  // Piece placement palette
  const [placingPiece, setPlacingPiece] = useState(null); // null | 'eraser' | { color, type }

  // Game mode (step through PGN)
  const [gamePositions, setGamePositions] = useState(null); // array of { fen, san, ply }
  const [gamePly, setGamePly] = useState(0);
  const [gameInfo, setGameInfo] = useState(null);

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key);
    if (key) localStorage.setItem('chessify-api-key', key);
    else localStorage.removeItem('chessify-api-key');
  }, []);

  // Initialize engine
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init().then(() => setEngineReady(true)).catch((err) => console.error('Failed to init Stockfish:', err));
    return () => engine.destroy();
  }, []);

  // Push current state to history before making a change
  const pushHistory = useCallback(() => {
    const currentFen = boardToFen(board, turn);
    setHistory(prev => {
      const next = [...prev, currentFen];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
  }, [board, turn]);

  // Undo — pop the last state from history
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevFen = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    try {
      const newGame = new Chess(prevFen);
      setGame(newGame);
      setBoard(fenToBoard(prevFen));
      setTurn(newGame.turn());
      setFen(prevFen);
    } catch {
      setBoard(fenToBoard(prevFen));
      setTurn(prevFen.split(' ')[1] || 'w');
      setFen(prevFen);
    }
    setSelectedSquare(null);
    setLegalMoves([]);
    setLines([]);
    setArrows([]);
    setAnalyzing(false);
    playUndoSound();
  }, [history]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Arrow keys for game navigation
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setGamePly(prev => {
          if (!gamePositions) return prev;
          return Math.min(prev + 1, gamePositions.length - 1);
        });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setGamePly(prev => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, gamePositions]);

  // Sync board when gamePly changes in game mode
  useEffect(() => {
    if (!gamePositions) return;
    const pos = gamePositions[gamePly];
    if (!pos) return;

    try {
      const newGame = new Chess(pos.fen);
      setGame(newGame);
      setBoard(fenToBoard(pos.fen));
      setTurn(newGame.turn());
      setFen(pos.fen);
    } catch {
      setBoard(fenToBoard(pos.fen));
      setTurn(pos.fen.split(' ')[1] || 'w');
      setFen(pos.fen);
    }
    setSelectedSquare(null);
    setLegalMoves([]);
    setLines([]);
    setArrows([]);
    setAnalyzing(false);
  }, [gamePositions, gamePly]);

  // Sync game state from FEN (with history push)
  const syncFromFen = useCallback((newFen, addToHistory = true) => {
    try {
      if (addToHistory) pushHistory();
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
      // Invalid FEN
    }
  }, [pushHistory]);

  // Sync from board array (with history push)
  const syncFromBoard = useCallback((newBoard, newTurn, isCapture = false) => {
    pushHistory();
    const t = newTurn || turn;
    const newFen = boardToFen(newBoard, t);
    setBoard(newBoard);
    setFen(newFen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLines([]);
    setArrows([]);
    setAnalyzing(false);
    try { setGame(new Chess(newFen)); } catch { /* fine */ }

    if (isCapture) playCaptureSound();
    else playMoveSound();
  }, [turn, pushHistory]);

  // Free-form square click
  const handleSquareClick = useCallback((square, rank, file) => {
    // Piece palette placement mode
    if (placingPiece) {
      const newBoard = board.map(r => [...r]);
      if (placingPiece === 'eraser') {
        if (newBoard[rank][file]) {
          newBoard[rank][file] = null;
          syncFromBoard(newBoard, undefined, true);
        }
      } else {
        newBoard[rank][file] = { color: placingPiece.color, type: placingPiece.type };
        syncFromBoard(newBoard);
      }
      return;
    }

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      const fromCoords = squareToCoords(selectedSquare);
      const newBoard = board.map(r => [...r]);
      const piece = newBoard[fromCoords.rank][fromCoords.file];
      const target = newBoard[rank][file];

      if (piece) {
        newBoard[fromCoords.rank][fromCoords.file] = null;
        newBoard[rank][file] = piece;
        syncFromBoard(newBoard, undefined, !!target);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
    }

    const piece = board[rank]?.[file];
    if (piece) {
      setSelectedSquare(square);
      setLegalMoves([]);
    }
  }, [selectedSquare, board, syncFromBoard, placingPiece]);

  // UCI to SAN
  const uciToSan = useCallback((uciMove, currentFen) => {
    try {
      const tempGame = new Chess(currentFen);
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
      const move = tempGame.move({ from, to, promotion });
      return move ? move.san : uciMove;
    } catch { return uciMove; }
  }, []);

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

  const handleAnalyze = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engineReady) return;

    // Stop any current analysis
    engine.stop();

    setAnalyzing(true);
    setLines([]);
    setArrows([]);
    setDepth(0);

    const currentFen = boardToFen(board, turn);
    const analysisTurn = turn; // capture for score normalization

    // Normalize Stockfish scores (side-to-move perspective) to white's perspective
    const normalizeLines = (rawLines) =>
      rawLines.map((line) => {
        if (analysisTurn === 'b') {
          return {
            ...line,
            score: -line.score,
            mateIn: line.isMate ? -line.mateIn : line.mateIn,
          };
        }
        return line;
      });

    engine.onProgress = ({ depth: d, lines: progressLines }) => {
      setDepth(d);
      if (progressLines && progressLines.length > 0) {
        const normalized = normalizeLines(progressLines);
        const withSan = normalized.map((line) => ({
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
        const normalized = normalizeLines(finalLines);
        const withSan = normalized.map((line) => ({
          ...line,
          sanMove: uciToSan(line.pv[0], currentFen),
        }));
        setLines(withSan);
        updateArrows(withSan);
      }
    };

    engine.analyze(currentFen, targetDepth, 3);
  }, [board, turn, engineReady, targetDepth, uciToSan, updateArrows]);

  const handleReset = useCallback(() => {
    setGamePositions(null);
    setPlacingPiece(null);
    syncFromFen(STARTING_FEN);
    playMoveSound();
  }, [syncFromFen]);

  const handleClear = useCallback(() => {
    setGamePositions(null);
    setPlacingPiece(null);
    syncFromFen(EMPTY_FEN);
    playMoveSound();
  }, [syncFromFen]);

  const handleToggleTurn = useCallback(() => {
    pushHistory();
    const newTurn = turn === 'w' ? 'b' : 'w';
    setTurn(newTurn);
    const newFen = boardToFen(board, newTurn);
    setFen(newFen);
    try { setGame(new Chess(newFen)); } catch { /* fine */ }
  }, [turn, board, pushHistory]);

  const handleFlip = useCallback(() => {
    const newFlipped = !flipped;
    setFlipped(newFlipped);
    // Auto-sync turn to match bottom player
    const bottomPlayerTurn = newFlipped ? 'b' : 'w';
    setTurn(bottomPlayerTurn);
    const newFen = boardToFen(board, bottomPlayerTurn);
    setFen(newFen);
    try { setGame(new Chess(newFen)); } catch { /* fine */ }
  }, [flipped, board]);

  const handleFenChange = useCallback((newFen) => {
    setFen(newFen);
    if (isValidFen(newFen)) syncFromFen(newFen);
  }, [syncFromFen]);

  const handleFenDetected = useCallback((detectedFen) => {
    setGamePositions(null);
    if (isValidFen(detectedFen)) {
      syncFromFen(detectedFen);
      // Update flip state based on detected side to move
      const detectedTurn = detectedFen.split(' ')[1] || 'w';
      setFlipped(detectedTurn === 'b');
      playMoveSound();
      return;
    }
    const cleaned = sanitizeFen(detectedFen);
    if (cleaned) {
      pushHistory();
      const newBoard = fenToBoard(cleaned);
      const newTurn = cleaned.split(' ')[1] || 'w';
      setBoard(newBoard);
      setFen(cleaned);
      setTurn(newTurn);
      setFlipped(newTurn === 'b');
      setSelectedSquare(null);
      setLegalMoves([]);
      setLines([]);
      setArrows([]);
      try { setGame(new Chess(cleaned)); } catch { /* fine */ }
      playMoveSound();
    }
  }, [syncFromFen, pushHistory]);

  // Game mode: load PGN
  const handleGameLoaded = useCallback((positions, metadata) => {
    setGamePositions(positions);
    setGamePly(0);
    setGameInfo(metadata);
    playMoveSound();
  }, []);

  const handleExitGame = useCallback(() => {
    setGamePositions(null);
    setGameInfo(null);
  }, []);

  const canUndo = history.length > 0;
  const inGameMode = !!gamePositions;

  // Compute visible arrows based on hovered line
  const visibleArrows = hoveredLine !== null
    ? arrows.filter((_, idx) => idx === hoveredLine).map(a => ({ ...a, opacity: 0.9 }))
    : arrows;

  // Extract best eval for the eval bar
  const bestLine = lines.length > 0 ? lines[0] : null;
  const bestCp = bestLine?.score ?? 0;
  const bestIsMate = bestLine?.isMate ?? false;
  const bestMateIn = bestLine?.mateIn ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ padding: '16px 32px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 12px var(--accent-glow)',
            }} />
            <h1 style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-primary)' }}>
              Chessify
            </h1>
            <span className="label" style={{ marginTop: 1 }}>Position Analyzer</span>
          </div>
          <button
            className="btn-ghost"
            onClick={() => setShowApiKey(!showApiKey)}
            style={{ fontSize: 12 }}
          >
            {apiKey ? 'API Key Set' : 'Set API Key'}
          </button>
        </div>
      </header>
      <div className="header-border" />

      {/* API Key input */}
      {showApiKey && (
        <>
          <div style={{ padding: '12px 32px' }}>
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
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
              />
            </div>
          </div>
          <div className="header-border" />
        </>
      )}

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px' }}>
        <div className="app-layout mx-auto" style={{ maxWidth: 1200 }}>
          {/* Left column: Board + controls */}
          <div className="flex flex-col gap-5">
            {/* Board + Eval Bar */}
            <div className="glass-static board-wrap" style={{ display: 'flex', gap: 12 }}>
              <EvalBar
                cp={bestCp}
                isMate={bestIsMate}
                mateIn={bestMateIn}
                visible={lines.length > 0}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Board
                  board={board}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  arrows={visibleArrows}
                  onSquareClick={handleSquareClick}
                  flipped={flipped}
                />
                <PiecePalette
                  placingPiece={placingPiece}
                  onSelect={setPlacingPiece}
                />
              </div>
            </div>

            {/* Game mode navigator */}
            {inGameMode && (
              <div className="glass-static" style={{ padding: '16px 20px' }}>
                {/* Game info */}
                {gameInfo && (gameInfo.White || gameInfo.Black) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {gameInfo.White || '?'} vs {gameInfo.Black || '?'}
                    </div>
                    <div className="label" style={{ fontSize: 10, marginTop: 3 }}>
                      {[gameInfo.Event, gameInfo.Date?.slice(0, 4), gameInfo.Result].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                )}

                {/* Move counter + navigation */}
                <div className="flex items-center gap-3">
                  <button
                    className="btn-ghost"
                    onClick={() => setGamePly(0)}
                    disabled={gamePly === 0}
                    style={{ opacity: gamePly === 0 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }}
                    title="Go to start"
                  >
                    ⏮
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setGamePly(p => Math.max(0, p - 1))}
                    disabled={gamePly === 0}
                    style={{ opacity: gamePly === 0 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }}
                    title="Previous move (←)"
                  >
                    ◀
                  </button>

                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {gamePly === 0 ? 'Start' : (
                        <>
                          Move {Math.ceil(gamePly / 2)}
                          <span style={{ color: 'var(--text-disabled)' }}>
                            {' '}{gamePositions[gamePly]?.san}
                          </span>
                        </>
                      )}
                    </span>
                    <div className="label" style={{ fontSize: 9, marginTop: 2 }}>
                      {gamePly} / {gamePositions.length - 1} ply
                    </div>
                  </div>

                  <button
                    className="btn-ghost"
                    onClick={() => setGamePly(p => Math.min(gamePositions.length - 1, p + 1))}
                    disabled={gamePly >= gamePositions.length - 1}
                    style={{ opacity: gamePly >= gamePositions.length - 1 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }}
                    title="Next move (→)"
                  >
                    ▶
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setGamePly(gamePositions.length - 1)}
                    disabled={gamePly >= gamePositions.length - 1}
                    style={{ opacity: gamePly >= gamePositions.length - 1 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }}
                    title="Go to end"
                  >
                    ⏭
                  </button>

                  <button
                    className="btn-ghost"
                    onClick={handleExitGame}
                    style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-disabled)' }}
                  >
                    Exit
                  </button>
                </div>
              </div>
            )}

            {/* Controls card */}
            <div className="glass-static" style={{ padding: '20px' }}>
              <div className="flex flex-col gap-3">
                <span className="label">Setup</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-ghost" onClick={handleReset}>Reset</button>
                  <button className="btn-ghost" onClick={handleClear}>Clear</button>
                  <button className="btn-ghost" onClick={handleToggleTurn}>
                    Turn: {turn === 'w' ? 'White' : 'Black'}
                  </button>
                  <button className="btn-ghost" onClick={handleFlip}>
                    Flip Board
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    style={{ opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'not-allowed' }}
                    title="Undo (Ctrl+Z)"
                  >
                    Undo
                  </button>
                </div>
                <input
                  type="text"
                  value={fen}
                  onChange={(e) => handleFenChange(e.target.value)}
                  placeholder="Paste FEN string..."
                  spellCheck={false}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--glass-radius-xs)',
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--glass-border)')}
                />
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              <div className="flex flex-col gap-3">
                <span className="label">Import Game</span>
                <GameImport onGameLoaded={handleGameLoaded} />
              </div>

              <div className="divider" style={{ margin: '16px 0' }} />

              <div className="flex flex-col gap-3">
                <span className="label">Import from Screenshot</span>
                <ScreenshotImport
                  onFenDetected={handleFenDetected}
                  apiKey={apiKey}
                />
              </div>
            </div>
          </div>

          {/* Right column: Analysis */}
          <div style={{ position: 'sticky', top: 24 }}>
            <AnalysisPanel
              lines={lines}
              depth={depth}
              targetDepth={targetDepth}
              analyzing={analyzing}
              onAnalyze={handleAnalyze}
              onLineHover={setHoveredLine}
              hoveredLine={hoveredLine}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
