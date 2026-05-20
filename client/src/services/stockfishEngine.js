/**
 * StockfishEngine — Clean API wrapper around the Stockfish Web Worker.
 * Runs chess calculations in a background thread to keep UI smooth.
 * 
 * The Stockfish.js WASM engine has built-in Web Worker support:
 * - Send UCI commands as plain strings via postMessage()
 * - Receive engine output as plain strings via onmessage
 */

const DIFFICULTY_MAP = [
  // level 1: Beginner
  { skillLevel: 0, depth: 1, moveTime: 300, name: 'Beginner', emoji: '🌱', elo: '~400' },
  // level 2: Easy
  { skillLevel: 3, depth: 3, moveTime: 400, name: 'Easy', emoji: '🎯', elo: '~800' },
  // level 3: Medium-Easy
  { skillLevel: 6, depth: 5, moveTime: 500, name: 'Medium-Easy', emoji: '📘', elo: '~1100' },
  // level 4: Medium
  { skillLevel: 9, depth: 8, moveTime: 600, name: 'Medium', emoji: '⚔️', elo: '~1400' },
  // level 5: Medium-Hard
  { skillLevel: 12, depth: 10, moveTime: 800, name: 'Medium-Hard', emoji: '🔥', elo: '~1700' },
  // level 6: Hard
  { skillLevel: 15, depth: 13, moveTime: 1000, name: 'Hard', emoji: '💪', elo: '~2000' },
  // level 7: Expert
  { skillLevel: 18, depth: 16, moveTime: 1200, name: 'Expert', emoji: '🧠', elo: '~2300' },
  // level 8: Maximum
  { skillLevel: 20, depth: 20, moveTime: 1500, name: 'Maximum', emoji: '👑', elo: '~3200' },
];

export function getDifficultyInfo(level) {
  return DIFFICULTY_MAP[Math.max(0, Math.min(level - 1, 7))];
}

export function getAllDifficulties() {
  return DIFFICULTY_MAP.map((d, i) => ({ ...d, level: i + 1 }));
}

export default class StockfishEngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.difficulty = DIFFICULTY_MAP[3]; // Default: Medium
    this._listeners = [];
    this._resolveReady = null;
    this._bestMoveResolve = null;
  }

  /**
   * Initialize the Stockfish Web Worker.
   * Returns a promise that resolves when the engine is ready.
   */
  init() {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('/stockfish.js');
        this._resolveReady = resolve;

        this.worker.onmessage = (e) => {
          // Stockfish sends plain string messages
          const line = typeof e.data === 'string' ? e.data : String(e.data);
          this._handleEngineOutput(line);
        };

        this.worker.onerror = (err) => {
          console.error('Stockfish worker error:', err);
          reject(err);
        };

        // Wait a bit for WASM to load, then send UCI init
        setTimeout(() => {
          this._sendCommand('uci');
        }, 100);
      } catch (err) {
        reject(err);
      }
    });
  }

  _sendCommand(cmd) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  _handleEngineOutput(line) {
    // Notify listeners
    this._listeners.forEach(fn => fn(line));

    // UCI initialization complete
    if (line === 'uciok') {
      this._sendCommand('isready');
    }

    // Engine ready
    if (line === 'readyok' && this._resolveReady) {
      this.isReady = true;
      this._resolveReady();
      this._resolveReady = null;
    }

    // Best move response
    if (line.startsWith('bestmove') && this._bestMoveResolve) {
      const parts = line.split(' ');
      const bestMove = parts[1]; // e.g. "e2e4"
      const ponder = parts[3] || null;
      this._bestMoveResolve({ bestMove, ponder });
      this._bestMoveResolve = null;
    }
  }

  /**
   * Add a listener for raw engine output lines.
   */
  addListener(fn) {
    this._listeners.push(fn);
  }

  removeListener(fn) {
    this._listeners = this._listeners.filter(l => l !== fn);
  }

  /**
   * Set difficulty level (1-8).
   */
  setDifficulty(level) {
    this.difficulty = DIFFICULTY_MAP[Math.max(0, Math.min(level - 1, 7))];
    this._sendCommand(`setoption name Skill Level value ${this.difficulty.skillLevel}`);
    this._sendCommand('isready');
  }

  /**
   * Start a new game in the engine.
   */
  newGame() {
    this._sendCommand('ucinewgame');
    this._sendCommand('isready');
  }

  /**
   * Get the engine's best move for a given FEN position.
   * Returns a promise with { bestMove: "e2e4", ponder: "e7e5"|null }
   */
  getBestMove(fen) {
    return new Promise((resolve) => {
      this._bestMoveResolve = resolve;
      this._sendCommand(`position fen ${fen}`);
      this._sendCommand(`go depth ${this.difficulty.depth}`);
    });
  }

  /**
   * Get a hint for the player's best move.
   * Uses a higher depth for better quality hints.
   */
  getHint(fen) {
    return new Promise((resolve) => {
      this._bestMoveResolve = resolve;
      this._sendCommand(`position fen ${fen}`);
      // Use depth 15 for hints (good quality regardless of difficulty)
      this._sendCommand('go depth 15');
    });
  }

  /**
   * Stop the engine from calculating.
   */
  stop() {
    this._sendCommand('stop');
  }

  /**
   * Destroy the worker and clean up.
   */
  destroy() {
    if (this.worker) {
      this._sendCommand('quit');
      setTimeout(() => {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
      }, 100);
    }
    this.isReady = false;
    this._listeners = [];
    this._bestMoveResolve = null;
  }
}
