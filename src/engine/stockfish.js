/**
 * Stockfish WASM Web Worker wrapper.
 * Communicates via UCI protocol messages.
 * Fetches the script as a blob to bypass cross-origin Worker restrictions.
 */

const STOCKFISH_CDN = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';

async function createWorkerFromUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl);
  // Clean up blob URL after worker starts
  worker.addEventListener('message', () => URL.revokeObjectURL(blobUrl), { once: true });
  return worker;
}

export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.analyzing = false;
    this.onAnalysis = null;
    this.onReady = null;
    this.onProgress = null;
    this.currentLines = new Map();
    this.targetDepth = 22;
  }

  async init() {
    try {
      this.worker = await createWorkerFromUrl(STOCKFISH_CDN);
    } catch (err) {
      console.error('Failed to fetch Stockfish:', err);
      throw err;
    }

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        this._handleMessage(e.data);
      };

      this.worker.onerror = (err) => {
        console.error('Stockfish worker error:', err);
        reject(err);
      };

      this._resolveReady = resolve;
      this._send('uci');
    });
  }

  _send(cmd) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  _handleMessage(line) {
    if (typeof line !== 'string') return;

    if (line === 'uciok') {
      this._send('isready');
    }

    if (line === 'readyok') {
      this.ready = true;
      if (this._resolveReady) {
        this._resolveReady();
        this._resolveReady = null;
      }
      if (this.onReady) this.onReady();
    }

    // Parse "info" lines for analysis data
    if (line.startsWith('info') && line.includes('score') && line.includes(' pv ')) {
      const parsed = this._parseInfo(line);
      if (parsed) {
        this.currentLines.set(parsed.multipv, parsed);

        if (this.onProgress && parsed.depth) {
          this.onProgress({
            depth: parsed.depth,
            targetDepth: this.targetDepth,
            lines: this._getSortedLines(),
          });
        }
      }
    }

    // "bestmove" signals analysis is complete
    if (line.startsWith('bestmove')) {
      this.analyzing = false;
      if (this.onAnalysis) {
        this.onAnalysis(this._getSortedLines());
      }
    }
  }

  _parseInfo(line) {
    const tokens = line.split(' ');
    const data = {};

    for (let i = 0; i < tokens.length; i++) {
      switch (tokens[i]) {
        case 'depth':
          data.depth = parseInt(tokens[i + 1]);
          break;
        case 'seldepth':
          data.seldepth = parseInt(tokens[i + 1]);
          break;
        case 'multipv':
          data.multipv = parseInt(tokens[i + 1]);
          break;
        case 'score':
          if (tokens[i + 1] === 'cp') {
            data.score = parseInt(tokens[i + 2]);
            data.isMate = false;
          } else if (tokens[i + 1] === 'mate') {
            data.mateIn = parseInt(tokens[i + 2]);
            data.isMate = true;
            data.score = data.mateIn > 0 ? 100000 - data.mateIn : -100000 - data.mateIn;
          }
          break;
        case 'nodes':
          data.nodes = parseInt(tokens[i + 1]);
          break;
        case 'nps':
          data.nps = parseInt(tokens[i + 1]);
          break;
        case 'pv': {
          data.pv = tokens.slice(i + 1).filter(t => t.length >= 2);
          i = tokens.length;
          break;
        }
      }
    }

    if (!data.multipv) data.multipv = 1;
    return data.pv ? data : null;
  }

  _getSortedLines() {
    const lines = Array.from(this.currentLines.values());
    lines.sort((a, b) => a.multipv - b.multipv);
    return lines;
  }

  analyze(fen, depth = 22, numLines = 3) {
    if (!this.ready) return;

    this.analyzing = true;
    this.currentLines.clear();
    this.targetDepth = depth;

    this._send('stop');
    this._send('ucinewgame');
    this._send('isready');

    const originalOnReady = this.onReady;
    this.onReady = () => {
      this._send(`setoption name MultiPV value ${numLines}`);
      this._send(`position fen ${fen}`);
      this._send(`go depth ${depth}`);
      this.onReady = originalOnReady;
    };
  }

  /**
   * Analyze a single position and resolve with the result lines.
   * Meant for sequential batch analysis (game review).
   * Returns a Promise that resolves with an array of line objects.
   */
  analyzeOnce(fen, depth = 14, numLines = 2) {
    return new Promise((resolve) => {
      this._send('stop');
      this.analyzing = true;
      this.currentLines.clear();
      this.targetDepth = depth;

      // Override callbacks for this one-shot analysis
      this.onProgress = null;
      this.onAnalysis = (lines) => {
        this.onAnalysis = null;
        resolve(lines);
      };

      this._send('ucinewgame');
      this._send('isready');

      this.onReady = () => {
        this.onReady = null;
        this._send(`setoption name MultiPV value ${numLines}`);
        this._send(`position fen ${fen}`);
        this._send(`go depth ${depth}`);
      };
    });
  }

  stop() {
    this._send('stop');
    this.analyzing = false;
  }

  destroy() {
    if (this.worker) {
      this._send('quit');
      this.worker.terminate();
      this.worker = null;
    }
  }
}
