import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuth } from '../../context/AuthContext';
import StockfishEngine, { getAllDifficulties, getDifficultyInfo } from '../../services/stockfishEngine';
import { getInitials } from '../../utils/constants';
import styles from './ComputerGame.module.css';

// Piece unicode for captured pieces display
const PIECE_SYMBOLS = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
};

export default function ComputerGame() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Setup state
  const [gamePhase, setGamePhase] = useState('setup'); // 'setup' | 'loading' | 'playing'
  const [selectedColor, setSelectedColor] = useState('white');
  const [selectedDifficulty, setSelectedDifficulty] = useState(4);

  // Game state
  const [fen, setFen] = useState('start');
  const [playerColor, setPlayerColor] = useState('white');
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win' | 'lose' | 'draw'
  const [resultReason, setResultReason] = useState('');
  const [moveHistory, setMoveHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);

  // Hint state
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [hintSquares, setHintSquares] = useState({});
  const [hintArrow, setHintArrow] = useState([]);
  const hintTimerRef = useRef(null);

  // Refs
  const chessRef = useRef(new Chess());
  const engineRef = useRef(null);
  const moveListRef = useRef(null);

  // Cleanup engine on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  // Auto scroll move list
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moveHistory]);

  // Start the game
  const startGame = async () => {
    setGamePhase('loading');

    // Determine color
    let color = selectedColor;
    if (color === 'random') {
      color = Math.random() < 0.5 ? 'white' : 'black';
    }
    setPlayerColor(color);

    // Initialize engine
    const engine = new StockfishEngine();
    engineRef.current = engine;

    try {
      await engine.init();
      engine.setDifficulty(selectedDifficulty);
      engine.newGame();

      // Reset game state
      const chess = new Chess();
      chessRef.current = chess;
      setFen(chess.fen());
      setMoveHistory([]);
      setGameOver(false);
      setGameResult(null);
      setResultReason('');
      setHintsRemaining(3);
      setHintSquares({});
      setHintArrow([]);
      setIsThinking(false);

      setGamePhase('playing');

      // If player is black, computer moves first
      if (color === 'black') {
        setTimeout(() => makeComputerMove(chess, engine), 500);
      }
    } catch (err) {
      console.error('Failed to initialize Stockfish:', err);
      alert('Failed to load chess engine. Please refresh and try again.');
      setGamePhase('setup');
    }
  };

  // Make computer move
  const makeComputerMove = useCallback(async (chess, engine) => {
    if (!chess || !engine || chess.isGameOver()) return;

    setIsThinking(true);
    const difficulty = getDifficultyInfo(selectedDifficulty);

    try {
      // Add a minimum delay for realism
      const startTime = Date.now();
      const result = await engine.getBestMove(chess.fen());
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, difficulty.moveTime - elapsed);

      await new Promise(resolve => setTimeout(resolve, remainingDelay));

      if (!result || !result.bestMove || result.bestMove === '(none)') {
        setIsThinking(false);
        return;
      }

      const from = result.bestMove.substring(0, 2);
      const to = result.bestMove.substring(2, 4);
      const promotion = result.bestMove.length > 4 ? result.bestMove[4] : undefined;

      const move = chess.move({ from, to, promotion });
      if (move) {
        setFen(chess.fen());
        setMoveHistory(chess.history({ verbose: true }));
        checkGameOver(chess);
      }
    } catch (err) {
      console.error('Engine error:', err);
    }

    setIsThinking(false);
  }, [selectedDifficulty]);

  // Check game over state
  const checkGameOver = (chess) => {
    if (chess.isCheckmate()) {
      setGameOver(true);
      // If it's the player's turn and checkmate, player lost
      const loserColor = chess.turn(); // the side that is in checkmate
      const playerTurn = playerColor === 'white' ? 'w' : 'b';
      setGameResult(loserColor === playerTurn ? 'lose' : 'win');
      setResultReason('Checkmate');
    } else if (chess.isStalemate()) {
      setGameOver(true);
      setGameResult('draw');
      setResultReason('Stalemate');
    } else if (chess.isThreefoldRepetition()) {
      setGameOver(true);
      setGameResult('draw');
      setResultReason('Threefold Repetition');
    } else if (chess.isInsufficientMaterial()) {
      setGameOver(true);
      setGameResult('draw');
      setResultReason('Insufficient Material');
    } else if (chess.isDraw()) {
      setGameOver(true);
      setGameResult('draw');
      setResultReason('Draw by 50-move rule');
    }
  };

  // Player move handler
  const onDrop = useCallback(({ sourceSquare, targetSquare, piece }) => {
    if (gameOver || isThinking) return false;

    const chess = chessRef.current;
    const engine = engineRef.current;

    // Check it's player's turn
    const myTurn = (chess.turn() === 'w' && playerColor === 'white') ||
                   (chess.turn() === 'b' && playerColor === 'black');
    if (!myTurn) return false;

    // Determine promotion
    const pieceStr = typeof piece === 'string' ? piece : (piece?.pieceType || '');
    const isPromotion = (pieceStr === 'P' || pieceStr === 'wP' || pieceStr === 'p' || pieceStr === 'bP') &&
      (targetSquare[1] === '8' || targetSquare[1] === '1');

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? 'q' : undefined,
      });

      if (!move) return false;

      // Clear any active hint
      setHintSquares({});
      setHintArrow([]);
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }

      setFen(chess.fen());
      setMoveHistory(chess.history({ verbose: true }));

      // Check game over after player move
      if (checkGameOver(chess)) return true;

      // Computer responds
      if (!chess.isGameOver()) {
        setTimeout(() => makeComputerMove(chess, engine), 200);
      }

      return true;
    } catch (err) {
      return false;
    }
  }, [gameOver, isThinking, playerColor, makeComputerMove]);

  // Hint handler
  const requestHint = async () => {
    if (hintsRemaining <= 0 || isThinking || gameOver) return;

    const chess = chessRef.current;
    const engine = engineRef.current;
    if (!chess || !engine) return;

    // Check it's player's turn
    const myTurn = (chess.turn() === 'w' && playerColor === 'white') ||
                   (chess.turn() === 'b' && playerColor === 'black');
    if (!myTurn) return;

    setHintsRemaining(prev => prev - 1);

    try {
      const result = await engine.getHint(chess.fen());
      if (result && result.bestMove && result.bestMove !== '(none)') {
        const from = result.bestMove.substring(0, 2);
        const to = result.bestMove.substring(2, 4);

        // Highlight squares
        setHintSquares({
          [from]: { background: 'rgba(245, 158, 11, 0.5)', borderRadius: '50%' },
          [to]: { background: 'rgba(245, 158, 11, 0.35)', borderRadius: '50%' },
        });

        // Show arrow
        setHintArrow([{ startSquare: from, endSquare: to, color: 'rgb(245, 158, 11)' }]);

        // Clear hint after 5 seconds
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        hintTimerRef.current = setTimeout(() => {
          setHintSquares({});
          setHintArrow([]);
        }, 5000);
      }
    } catch (err) {
      console.error('Hint error:', err);
    }
  };

  // Resign
  const resign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      setGameOver(true);
      setGameResult('lose');
      setResultReason('Resignation');
    }
  };

  // New game (back to setup)
  const newGame = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    setGamePhase('setup');
    setGameOver(false);
    setFen('start');
    setMoveHistory([]);
    setHintSquares({});
    setHintArrow([]);
  };

  // Rematch (same settings)
  const rematch = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }
    setGameOver(false);
    startGame();
  };

  // Get captured pieces
  const getCapturedPieces = useMemo(() => {
    if (moveHistory.length === 0) return { white: [], black: [] };

    const captured = { white: [], black: [] };
    moveHistory.forEach(move => {
      if (move.captured) {
        // If white captured, the captured piece was black
        if (move.color === 'w') {
          captured.white.push(move.captured);
        } else {
          captured.black.push(move.captured);
        }
      }
    });

    // Sort by piece value
    const pieceOrder = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    captured.white.sort((a, b) => pieceOrder[a] - pieceOrder[b]);
    captured.black.sort((a, b) => pieceOrder[a] - pieceOrder[b]);

    return captured;
  }, [moveHistory]);

  // Format move history into pairs
  const movePairs = useMemo(() => {
    const pairs = [];
    const history = chessRef.current?.history() || [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1],
      });
    }
    return pairs;
  }, [moveHistory]);

  const difficulties = getAllDifficulties();
  const currentDifficulty = getDifficultyInfo(selectedDifficulty);

  // ============ SETUP SCREEN ============
  if (gamePhase === 'setup') {
    return (
      <div className={styles.setupOverlay}>
        <div className={`${styles.setupCard} glass-card`}>
          <h1 className={styles.setupTitle}>
            🤖 <span>Play vs Computer</span>
          </h1>
          <p className={styles.setupSubtitle}>
            Challenge the Stockfish engine and sharpen your skills
          </p>

          {/* Color Selection */}
          <div className={styles.setupSection}>
            <span className={styles.sectionLabel}>Choose your color</span>
            <div className={styles.colorOptions}>
              <button
                className={`${styles.colorBtn} ${selectedColor === 'white' ? styles.selected : ''}`}
                onClick={() => setSelectedColor('white')}
              >
                <span className={styles.colorIcon}>♔</span>
                <span className={styles.colorLabel}>White</span>
              </button>
              <button
                className={`${styles.colorBtn} ${selectedColor === 'random' ? styles.selected : ''}`}
                onClick={() => setSelectedColor('random')}
              >
                <span className={styles.colorIcon}>🎲</span>
                <span className={styles.colorLabel}>Random</span>
              </button>
              <button
                className={`${styles.colorBtn} ${selectedColor === 'black' ? styles.selected : ''}`}
                onClick={() => setSelectedColor('black')}
              >
                <span className={styles.colorIcon}>♚</span>
                <span className={styles.colorLabel}>Black</span>
              </button>
            </div>
          </div>

          {/* Difficulty Selection */}
          <div className={styles.setupSection}>
            <span className={styles.sectionLabel}>Difficulty Level</span>
            <div className={styles.difficultyGrid}>
              {difficulties.map((d) => (
                <button
                  key={d.level}
                  className={`${styles.difficultyBtn} ${selectedDifficulty === d.level ? styles.selected : ''}`}
                  onClick={() => setSelectedDifficulty(d.level)}
                >
                  <span className={styles.diffEmoji}>{d.emoji}</span>
                  <span className={styles.diffName}>{d.name}</span>
                  <span className={styles.diffElo}>{d.elo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button className={`btn btn-primary ${styles.startBtn}`} onClick={startGame}>
            ⚔️ Start Game
          </button>
        </div>
      </div>
    );
  }

  // ============ LOADING SCREEN ============
  if (gamePhase === 'loading') {
    return (
      <div className={styles.loadingOverlay}>
        <div className="spinner spinner-lg" />
        <p className={styles.loadingText}>Initializing Stockfish Engine...</p>
      </div>
    );
  }

  // ============ GAME SCREEN ============
  const isPlayerTurn = playerColor === 'white'
    ? chessRef.current.turn() === 'w'
    : chessRef.current.turn() === 'b';

  const isCheck = chessRef.current.isCheck();

  // Game result display
  const getGameOverEmoji = () => {
    if (gameResult === 'win') return '🏆';
    if (gameResult === 'lose') return '😔';
    return '🤝';
  };

  const getGameOverText = () => {
    if (gameResult === 'win') return 'You Won!';
    if (gameResult === 'lose') return 'You Lost';
    return 'Draw';
  };

  return (
    <div className={styles.gameContainer}>
      {/* Left Panel — Move History */}
      <div className={styles.leftPanel}>
        <div className={`${styles.moveHistory} glass-card`} ref={moveListRef}>
          <div className={styles.panelHeader}>📝 Moves</div>
          <div className={styles.moveList}>
            {movePairs.map((pair, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <span className={styles.moveNumber}>{pair.number}.</span>
                <span className={`${styles.move} ${(i * 2 === moveHistory.length - 1) ? styles.current : ''}`}>
                  {pair.white}
                </span>
                <span className={`${styles.move} ${(i * 2 + 1 === moveHistory.length - 1) ? styles.current : ''}`}>
                  {pair.black || ''}
                </span>
              </div>
            ))}
          </div>
          {movePairs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
              No moves yet
            </p>
          )}
        </div>
      </div>

      {/* Center — Chess Board */}
      <div className={styles.boardSection}>
        {/* Computer bar (top if player is white, else bottom) */}
        <div className={`${styles.playerBar} ${!isPlayerTurn && !gameOver ? styles.active : ''}`}>
          <div className={styles.computerAvatar}>🤖</div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>Stockfish</div>
            <div className={styles.playerMeta}>{currentDifficulty.emoji} {currentDifficulty.name} ({currentDifficulty.elo})</div>
          </div>
          {isThinking && (
            <div className="badge badge-yellow">Thinking...</div>
          )}
        </div>

        {/* Board */}
        <div className={styles.boardWrapper}>
          <Chessboard
            options={{
              id: 'computer-game-board',
              position: fen,
              onPieceDrop: onDrop,
              boardOrientation: playerColor,
              boardStyle: { borderRadius: '0' },
              darkSquareStyle: { backgroundColor: '#7b6b5a' },
              lightSquareStyle: { backgroundColor: '#e8dcc8' },
              dropSquareStyle: { boxShadow: 'inset 0 0 1px 6px rgba(124, 58, 237, 0.5)' },
              squareStyles: hintSquares,
              arrows: hintArrow,
              animationDurationInMs: 200,
              allowDragging: !gameOver && !isThinking && isPlayerTurn,
            }}
          />
        </div>

        {/* Player bar (bottom) */}
        <div className={`${styles.playerBar} ${isPlayerTurn && !gameOver ? styles.active : ''}`}
             style={{ marginTop: '8px', marginBottom: 0 }}>
          <div className={styles.playerAvatar}>{getInitials(user?.username || 'You')}</div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>{user?.username || 'You'} (You)</div>
            <div className={styles.playerMeta}>
              Playing as {playerColor === 'white' ? '♔ White' : '♚ Black'}
            </div>
          </div>
          {isCheck && isPlayerTurn && !gameOver && (
            <div className="badge badge-red">Check!</div>
          )}
        </div>

        {/* Game Controls */}
        {!gameOver && (
          <div className={styles.gameControls}>
            <button
              className={`${styles.controlBtn} ${styles.hintBtn}`}
              onClick={requestHint}
              disabled={hintsRemaining <= 0 || isThinking || !isPlayerTurn}
              title={hintsRemaining > 0 ? `Get a hint (${hintsRemaining} remaining)` : 'No hints remaining'}
            >
              💡 Hint <span className={styles.hintCount}>({hintsRemaining}/3)</span>
            </button>
            <button className={`${styles.controlBtn} ${styles.danger}`} onClick={resign}>
              🏳️ Resign
            </button>
            <button className={styles.controlBtn} onClick={newGame}>
              🔄 New Game
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className={styles.sidebar}>
        {/* Engine Status */}
        <div className={`${styles.engineStatus} glass-card`}>
          <div className={styles.infoTitle}>
            <span className={`${styles.statusDot} ${isThinking ? styles.thinking : styles.ready}`} />
            Engine Status
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isThinking ? 'Stockfish is calculating...' : 'Waiting for your move'}
          </p>
          {isThinking && (
            <div className={styles.thinkingBar}>
              <div className={styles.thinkingProgress} />
            </div>
          )}
        </div>

        {/* Game Info */}
        <div className={`${styles.infoPanel} glass-card`}>
          <div className={styles.infoTitle}>📊 Game Info</div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Difficulty</span>
            <span className={styles.infoValue}>{currentDifficulty.emoji} {currentDifficulty.name}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Engine ELO</span>
            <span className={styles.infoValue}>{currentDifficulty.elo}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Your Color</span>
            <span className={styles.infoValue}>{playerColor === 'white' ? '♔ White' : '♚ Black'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Move #</span>
            <span className={styles.infoValue}>{Math.ceil(moveHistory.length / 2) || 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Hints Left</span>
            <span className={styles.infoValue}>{hintsRemaining}/3</span>
          </div>
        </div>

        {/* Captured Pieces */}
        <div className={`${styles.capturedPieces} glass-card`}>
          <div className={styles.infoTitle}>⚔️ Captured Pieces</div>
          <div>
            <div className={styles.capturedLabel}>
              {playerColor === 'white' ? 'Your captures' : "Computer's captures"}
            </div>
            <div className={styles.capturedRow}>
              {getCapturedPieces.white.map((p, i) => (
                <span key={i} className={styles.capturedPiece}>
                  {PIECE_SYMBOLS[p] || p}
                </span>
              ))}
              {getCapturedPieces.white.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
          </div>
          <div>
            <div className={styles.capturedLabel}>
              {playerColor === 'black' ? 'Your captures' : "Computer's captures"}
            </div>
            <div className={styles.capturedRow}>
              {getCapturedPieces.black.map((p, i) => (
                <span key={i} className={styles.capturedPiece}>
                  {PIECE_SYMBOLS[p.toUpperCase()] || p}
                </span>
              ))}
              {getCapturedPieces.black.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Game Over Overlay */}
      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={`${styles.gameOverCard} glass-card`}>
            <div className={`${styles.gameOverResult} ${styles[gameResult]}`}>
              {getGameOverEmoji()} {getGameOverText()}
            </div>
            <div className={styles.gameOverReason}>{resultReason}</div>
            <div className={styles.gameOverDifficulty}>
              vs Stockfish {currentDifficulty.emoji} {currentDifficulty.name} ({currentDifficulty.elo})
            </div>
            <div className={styles.gameOverActions}>
              <button className="btn btn-primary" onClick={rematch}>
                🔄 Rematch
              </button>
              <button className="btn btn-secondary" onClick={newGame}>
                ⚙️ New Game
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>
                🏠 Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
