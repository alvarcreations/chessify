import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from './components/Board';
import AnalysisPanel from './components/AnalysisPanel';
import EvalBar from './components/EvalBar';
import ReviewPanel from './components/ReviewPanel';
import ScreenshotImport from './components/ScreenshotImport';
import GameImport from './components/GameImport';
import { StockfishEngine } from './engine/stockfish';
import { STARTING_FEN, EMPTY_FEN, fenToBoard, boardToFen, squareToCoords, isValidFen, sanitizeFen } from './utils/fen';
import { playMoveSound, playCaptureSound, playUndoSound } from './utils/sound';
import { classifyMove, computeAccuracy, MOVE_CLASS } from './utils/review';

const MAX_HISTORY = 50;
const REVIEW_DEPTH = 14;

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [board, setBoard] = useState(() => fenToBoard(STARTING_FEN));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [turn, setTurn] = useState('w');
  const [fen, setFen] = useState(STARTING_FEN);
  const [flipped, setFlipped] = useState(false);

  // Undo history
  const [history, setHistory] = useState([]);

  // Interactive analysis state
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

  // Game mode (step through PGN)
  const [gamePositions, setGamePositions] = useState(null);
  const [gamePly, setGamePly] = useState(0);
  const [gameInfo, setGameInfo] = useState(null);

  // Game review data
  const [gameEvals, setGameEvals] = useState(null);   // white-perspective eval for each ply
  const [gameReview, setGameReview] = useState(null); // classification per ply
  const [reviewAnalyzing, setReviewAnalyzing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [whiteAccuracy, setWhiteAccuracy] = useState(null);
  const [blackAccuracy, setBlackAccuracy] = useState(null);
  const reviewCancelRef = useRef(false);

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

  // Undo
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
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setGamePly(prev => gamePositions ? Math.min(prev + 1, gamePositions.length - 1) : prev);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setGamePly(prev => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, gamePositions]);

  // Sync board when gamePly changes
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

  // Sync game state from FEN
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
    } catch { /* Invalid FEN */ }
  }, [pushHistory]);

  // Sync from board array
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
    if (selectedSquare) {
      if (selectedSquare === square) { setSelectedSquare(null); setLegalMoves([]); return; }
      const fromCoords = squareToCoords(selectedSquare);
      const newBoard = board.map(r => [...r]);
      const piece = newBoard[fromCoords.rank][fromCoords.file];
      const target = newBoard[rank][file];
      if (piece) {
        newBoard[fromCoords.rank][fromCoords.file] = null;
        newBoard[rank][file] = piece;
        syncFromBoard(newBoard, undefined, !!target);
      } else {
        setSelectedSquare(null); setLegalMoves([]);
      }
      return;
    }
    const piece = board[rank]?.[file];
    if (piece) { setSelectedSquare(square); setLegalMoves([]); }
  }, [selectedSquare, board, syncFromBoard]);

  // UCI to SAN conversion
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

  // SAN to UCI conversion
  const sanToUci = useCallback((san, currentFen) => {
    try {
      const tempGame = new Chess(currentFen);
      const move = tempGame.move(san);
      return move ? move.from + move.to + (move.promotion || '') : null;
    } catch { return null; }
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

  // Interactive analysis
  const handleAnalyze = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engineReady || reviewAnalyzing) return;
    engine.stop();
    setAnalyzing(true);
    setLines([]);
    setArrows([]);
    setDepth(0);
    const currentFen = boardToFen(board, turn);
    const analysisTurn = turn;

    const normalizeLines = (rawLines) =>
      rawLines.map((line) => analysisTurn === 'b'
        ? { ...line, score: -line.score, mateIn: line.isMate ? -line.mateIn : line.mateIn }
        : line
      );

    engine.onProgress = ({ depth: d, lines: progressLines }) => {
      setDepth(d);
      if (progressLines?.length > 0) {
        const normalized = normalizeLines(progressLines);
        const withSan = normalized.map((line) => ({ ...line, sanMove: uciToSan(line.pv[0], currentFen) }));
        setLines(withSan);
        updateArrows(withSan);
      }
    };

    engine.onAnalysis = (finalLines) => {
      setAnalyzing(false);
      if (finalLines?.length > 0) {
        const normalized = normalizeLines(finalLines);
        const withSan = normalized.map((line) => ({ ...line, sanMove: uciToSan(line.pv[0], currentFen) }));
        setLines(withSan);
        updateArrows(withSan);
      }
    };

    engine.analyze(currentFen, targetDepth, 3);
  }, [board, turn, engineReady, reviewAnalyzing, targetDepth, uciToSan, updateArrows]);

  // Game review: analyze all positions sequentially
  const handleReviewGame = useCallback(async () => {
    if (!gamePositions || gamePositions.length < 2) return;
    const engine = engineRef.current;
    if (!engine || !engineReady) return;

    // Cancel any ongoing analysis
    engine.stop();
    reviewCancelRef.current = false;
    setReviewAnalyzing(true);
    setReviewProgress(0);
    setGameReview(null);
    setGameEvals(null);
    setWhiteAccuracy(null);
    setBlackAccuracy(null);

    try {
      const total = gamePositions.length;
      const rawScores = []; // score from side-to-move perspective for each position
      const isMates = [];
      const bestUcis = [];
      const secondBestGaps = []; // how much worse second best was (null if only 1 line)

      // Phase 1: analyze all positions
      for (let i = 0; i < total; i++) {
        if (reviewCancelRef.current) break;

        const pos = gamePositions[i];
        const lines = await engine.analyzeOnce(pos.fen, REVIEW_DEPTH, 2);

        const top = lines[0];
        if (top) {
          rawScores.push(top.score);
          isMates.push(top.isMate);
          bestUcis.push(top.pv?.[0] ?? null);
          // Gap between best and second best (if two lines available)
          const second = lines[1];
          secondBestGaps.push(second ? Math.max(0, top.score - second.score) : null);
        } else {
          rawScores.push(0);
          isMates.push(false);
          bestUcis.push(null);
          secondBestGaps.push(null);
        }

        setReviewProgress((i + 1) / total);
      }

      if (reviewCancelRef.current) return;

      // Phase 2: compute evals and classifications
      const evals = rawScores.map((score, i) => {
        const side = gamePositions[i].fen.split(' ')[1];
        return side === 'w' ? score : -score; // normalized to white's perspective
      });

      setGameEvals(evals);

      const reviewData = [null]; // index 0 = start position, no move
      const whiteLosses = [];
      const blackLosses = [];

      for (let i = 0; i < gamePositions.length - 1; i++) {
        const posFen = gamePositions[i].fen;
        const side_i = posFen.split(' ')[1];

        const score_i = rawScores[i] ?? 0;
        const score_i1 = rawScores[i + 1] ?? 0;

        // cpLoss from mover's perspective: score_i + score_i1
        const cpLoss = Math.max(0, score_i + score_i1);

        // Eval for classification context (mover's perspective)
        const moverEvalBefore = score_i;
        const moverEvalAfter = -(score_i1 ?? 0);

        // Determine if the played move was the engine's top choice
        const bestUci = bestUcis[i];
        const playedSan = gamePositions[i + 1].san;
        const playedUci = sanToUci(playedSan, posFen);
        const isBestMove = bestUci != null && playedUci != null && bestUci === playedUci;

        const cls = classifyMove({
          cpLoss,
          moverEvalBefore,
          moverEvalAfter,
          isBestMove,
          secondBestGap: secondBestGaps[i],
          ply: i,
        });

        // Best move in SAN
        const bestSan = bestUci ? uciToSan(bestUci, posFen) : null;

        // Evals in white's perspective for display
        const evalBefore = evals[i];
        const evalAfter = evals[i + 1] ?? 0;

        reviewData.push({
          classification: cls,
          cpLoss,
          bestSan,
          playedSan,
          evalBefore,
          evalAfter,
          isBestMove,
        });

        if (side_i === 'w') whiteLosses.push(cpLoss);
        else blackLosses.push(cpLoss);
      }

      setGameReview(reviewData);
      setWhiteAccuracy(computeAccuracy(whiteLosses));
      setBlackAccuracy(computeAccuracy(blackLosses));
    } catch (err) {
      console.error('Review failed:', err);
    } finally {
      setReviewAnalyzing(false);
    }
  }, [gamePositions, engineReady, uciToSan, sanToUci]);

  const handleReset = useCallback(() => {
    reviewCancelRef.current = true;
    setGamePositions(null); setGameInfo(null); setGameReview(null); setGameEvals(null);
    syncFromFen(STARTING_FEN);
    playMoveSound();
  }, [syncFromFen]);

  const handleClear = useCallback(() => {
    reviewCancelRef.current = true;
    setGamePositions(null); setGameInfo(null); setGameReview(null); setGameEvals(null);
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
    setGamePositions(null); setGameInfo(null); setGameReview(null); setGameEvals(null);
    if (isValidFen(detectedFen)) {
      syncFromFen(detectedFen);
      const detectedTurn = detectedFen.split(' ')[1] || 'w';
      setFlipped(detectedTurn === 'b');
      playMoveSound();
      return;
    }
    const cleaned = sanitizeFen(detectedFen);
    if (cleaned) {
      pushHistory();
      const newTurn = cleaned.split(' ')[1] || 'w';
      setBoard(fenToBoard(cleaned));
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

  const handleGameLoaded = useCallback((positions, metadata) => {
    reviewCancelRef.current = true;
    setGamePositions(positions);
    setGamePly(0);
    setGameInfo(metadata);
    setGameReview(null);
    setGameEvals(null);
    setWhiteAccuracy(null);
    setBlackAccuracy(null);
    playMoveSound();
  }, []);

  const handleExitGame = useCallback(() => {
    reviewCancelRef.current = true;
    setGamePositions(null);
    setGameInfo(null);
    setGameReview(null);
    setGameEvals(null);
  }, []);

  const inGameMode = !!gamePositions;
  const canUndo = history.length > 0;

  // Visible arrows (hover-to-isolate)
  const visibleArrows = hoveredLine !== null
    ? arrows.filter((_, idx) => idx === hoveredLine).map(a => ({ ...a, opacity: 0.9 }))
    : arrows;

  // Eval bar source: precomputed (game mode) or live analysis
  const gameEvalAtPly = inGameMode && gameEvals ? gameEvals[gamePly] : null;
  const liveEvalLine = lines.length > 0 ? lines[0] : null;

  const evalBarCp = gameEvalAtPly != null ? gameEvalAtPly : (liveEvalLine?.score ?? 0);
  const evalBarIsMate = gameEvalAtPly == null ? (liveEvalLine?.isMate ?? false) : false;
  const evalBarMateIn = gameEvalAtPly == null ? (liveEvalLine?.mateIn ?? 0) : 0;
  const evalBarVisible = gameEvalAtPly != null || lines.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ padding: '16px 32px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }} />
            <h1 style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-primary)' }}>Chessify</h1>
            <span className="label" style={{ marginTop: 1 }}>Position Analyzer</span>
          </div>
          <button className="btn-ghost" onClick={() => setShowApiKey(!showApiKey)} style={{ fontSize: 12 }}>
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
                  flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--glass-radius-xs)', padding: '8px 12px', color: 'var(--text-primary)',
                  fontSize: 12, fontFamily: 'monospace', outline: 'none', transition: 'border-color var(--transition-fast)',
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
      <main style={{ flex: 1, padding: '24px 32px' }}>
        <div className="app-layout">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Board + Eval Bar */}
            <div className="glass-static board-wrap" style={{ display: 'flex', gap: 12 }}>
              <EvalBar cp={evalBarCp} isMate={evalBarIsMate} mateIn={evalBarMateIn} visible={evalBarVisible} />
              <Board
                board={board}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                arrows={visibleArrows}
                onSquareClick={handleSquareClick}
                flipped={flipped}
              />
            </div>

            {/* Game navigator */}
            {inGameMode && (
              <div className="glass-static" style={{ padding: '16px 20px' }}>
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
                <div className="flex items-center gap-3">
                  <button className="btn-ghost" onClick={() => setGamePly(0)} disabled={gamePly === 0}
                    style={{ opacity: gamePly === 0 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }} title="Start">⏮</button>
                  <button className="btn-ghost" onClick={() => setGamePly(p => Math.max(0, p - 1))} disabled={gamePly === 0}
                    style={{ opacity: gamePly === 0 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }} title="Prev (←)">◀</button>

                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {gamePly === 0 ? 'Start' : (
                        <>
                          <span>Move {Math.ceil(gamePly / 2)}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{gamePositions[gamePly]?.san}</span>
                          {gameReview?.[gamePly] && (() => {
                            const cls = gameReview[gamePly].classification;
                            const info = MOVE_CLASS[cls];
                            return info?.symbol ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: info.color,
                                background: info.bg, padding: '1px 5px', borderRadius: 4,
                              }}>{info.symbol}</span>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                    <div className="label" style={{ fontSize: 9, marginTop: 2 }}>
                      {gamePly} / {gamePositions.length - 1} ply
                    </div>
                  </div>

                  <button className="btn-ghost" onClick={() => setGamePly(p => Math.min(gamePositions.length - 1, p + 1))}
                    disabled={gamePly >= gamePositions.length - 1}
                    style={{ opacity: gamePly >= gamePositions.length - 1 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }} title="Next (→)">▶</button>
                  <button className="btn-ghost" onClick={() => setGamePly(gamePositions.length - 1)}
                    disabled={gamePly >= gamePositions.length - 1}
                    style={{ opacity: gamePly >= gamePositions.length - 1 ? 0.3 : 1, padding: '6px 10px', fontSize: 14 }} title="End">⏭</button>
                  <button className="btn-ghost" onClick={handleExitGame}
                    style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-disabled)' }}>Exit</button>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="glass-static" style={{ padding: '20px' }}>
              <div className="flex flex-col gap-3">
                <span className="label">Setup</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-ghost" onClick={handleReset}>Reset</button>
                  <button className="btn-ghost" onClick={handleClear}>Clear</button>
                  <button className="btn-ghost" onClick={handleToggleTurn}>Turn: {turn === 'w' ? 'White' : 'Black'}</button>
                  <button className="btn-ghost" onClick={handleFlip}>Flip Board</button>
                  <button className="btn-ghost" onClick={handleUndo} disabled={!canUndo}
                    style={{ opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'not-allowed' }} title="Undo (Ctrl+Z)">Undo</button>
                </div>
                <input
                  type="text" value={fen} onChange={(e) => handleFenChange(e.target.value)}
                  placeholder="Paste FEN string..." spellCheck={false}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--glass-radius-xs)', padding: '10px 14px', color: 'var(--text-primary)',
                    fontSize: 12, fontFamily: 'monospace', outline: 'none', transition: 'border-color var(--transition-fast)',
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
                <ScreenshotImport onFenDetected={handleFenDetected} apiKey={apiKey} />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Review panel (game mode only) */}
            {inGameMode && (
              <ReviewPanel
                ply={gamePly}
                positions={gamePositions}
                review={gameReview}
                reviewAnalyzing={reviewAnalyzing}
                reviewProgress={reviewProgress}
                onReview={handleReviewGame}
                onJumpToPly={setGamePly}
                whiteAccuracy={whiteAccuracy}
                blackAccuracy={blackAccuracy}
              />
            )}

            {/* Engine analysis */}
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
