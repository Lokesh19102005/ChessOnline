import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuth } from '../../context/AuthContext';
import { gameService } from '../../services/services';
import { getInitials } from '../../utils/constants';
import styles from './GameReview.module.css';

export default function GameReview() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Replay state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);
  const chessRef = useRef(new Chess());

  // Board size
  const [boardWidth, setBoardWidth] = useState(560);

  useEffect(() => {
    const updateSize = () => {
      const maxW = Math.min(window.innerWidth - 500, 600);
      const maxH = window.innerHeight - 200;
      setBoardWidth(Math.max(300, Math.min(maxW, maxH)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        const res = await gameService.getGame(gameId);
        setGame(res.data.game);
      } catch (err) {
        console.error('Failed to load game:', err);
        setError('Game not found or failed to load.');
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  // Navigate to a specific move index
  const goToMove = useCallback((index) => {
    if (!game) return;
    const moves = game.moves || [];
    const clampedIndex = Math.max(-1, Math.min(index, moves.length - 1));

    chessRef.current.reset();
    for (let i = 0; i <= clampedIndex; i++) {
      const move = moves[i];
      chessRef.current.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || undefined
      });
    }
    setFen(chessRef.current.fen());
    setCurrentMoveIndex(clampedIndex);
  }, [game]);

  const goToStart = useCallback(() => {
    setIsPlaying(false);
    goToMove(-1);
  }, [goToMove]);

  const goToPrev = useCallback(() => {
    setIsPlaying(false);
    goToMove(currentMoveIndex - 1);
  }, [goToMove, currentMoveIndex]);

  const goToNext = useCallback(() => {
    if (!game) return;
    if (currentMoveIndex >= (game.moves?.length || 0) - 1) {
      setIsPlaying(false);
      return;
    }
    goToMove(currentMoveIndex + 1);
  }, [goToMove, currentMoveIndex, game]);

  const goToEnd = useCallback(() => {
    if (!game) return;
    setIsPlaying(false);
    goToMove((game.moves?.length || 0) - 1);
  }, [goToMove, game]);

  // Auto-play
  const togglePlay = useCallback(() => {
    if (!game) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If at the end, restart from beginning
      if (currentMoveIndex >= (game.moves?.length || 0) - 1) {
        goToMove(-1);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, game, currentMoveIndex, goToMove]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying && game) {
      playIntervalRef.current = setInterval(() => {
        setCurrentMoveIndex(prev => {
          const nextIdx = prev + 1;
          if (nextIdx >= game.moves.length) {
            setIsPlaying(false);
            clearInterval(playIntervalRef.current);
            return prev;
          }
          // Replay move
          chessRef.current.reset();
          for (let i = 0; i <= nextIdx; i++) {
            const move = game.moves[i];
            chessRef.current.move({
              from: move.from,
              to: move.to,
              promotion: move.promotion || undefined
            });
          }
          setFen(chessRef.current.fen());
          return nextIdx;
        });
      }, 1000);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, game]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStart();
      } else if (e.key === 'End') {
        e.preventDefault();
        goToEnd();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, goToStart, goToEnd, togglePlay]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>😕</div>
          <h2>Game Not Found</h2>
          <p>{error || 'This game could not be loaded.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/history')}>
            ← Back to History
          </button>
        </div>
      </div>
    );
  }

  const moves = game.moves || [];
  const whitePlayer = game.whitePlayer;
  const blackPlayer = game.blackPlayer;
  const isWhite = (whitePlayer._id || whitePlayer) === user?._id;
  const playerColor = isWhite ? 'white' : 'black';

  // Format move history into pairs for display
  const movePairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1] || null,
      whiteIndex: i,
      blackIndex: i + 1
    });
  }

  // Result info
  const getResultText = () => {
    if (game.result === 'draw') return '🤝 Draw';
    if (game.result === 'white') return '⬜ White Wins';
    if (game.result === 'black') return '⬛ Black Wins';
    return '❓ Unknown';
  };

  const getResultColor = () => {
    if (game.result === 'draw') return 'var(--accent-warning)';
    const didWin = (isWhite && game.result === 'white') || (!isWhite && game.result === 'black');
    return didWin ? 'var(--accent-success)' : 'var(--accent-danger)';
  };

  return (
    <div className={styles.reviewContainer}>
      {/* Left Panel - Move List */}
      <div className={styles.leftPanel}>
        <div className={`${styles.movePanel} glass-card`}>
          <div className={styles.movePanelHeader}>
            <h3>📝 Move History</h3>
            <span className={styles.moveCount}>{moves.length} moves</span>
          </div>
          <div className={styles.moveList}>
            {movePairs.map((pair) => (
              <div key={pair.number} style={{ display: 'contents' }}>
                <span className={styles.moveNumber}>{pair.number}.</span>
                <span
                  className={`${styles.move} ${currentMoveIndex === pair.whiteIndex ? styles.activeMoveItem : ''}`}
                  onClick={() => { setIsPlaying(false); goToMove(pair.whiteIndex); }}
                >
                  {pair.white?.san}
                </span>
                <span
                  className={`${styles.move} ${pair.black && currentMoveIndex === pair.blackIndex ? styles.activeMoveItem : ''}`}
                  onClick={() => { if (pair.black) { setIsPlaying(false); goToMove(pair.blackIndex); } }}
                >
                  {pair.black?.san || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center - Board */}
      <div className={styles.boardSection}>
        {/* Opponent bar (top — from current user's perspective) */}
        <div className={styles.playerBar}>
          <div className="avatar avatar-sm">
            {getInitials(playerColor === 'white' ? blackPlayer.username : whitePlayer.username)}
          </div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>
              {playerColor === 'white' ? blackPlayer.username : whitePlayer.username}
            </div>
            <div className={styles.playerRating}>
              {playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating}
            </div>
          </div>
        </div>

        {/* Board */}
        <div className={styles.boardWrapper}>
          <Chessboard
            options={{
              id: 'review-board',
              position: fen,
              boardOrientation: playerColor,
              boardStyle: { borderRadius: '0', width: `${boardWidth}px`, height: `${boardWidth}px` },
              darkSquareStyle: { backgroundColor: '#7b6b5a' },
              lightSquareStyle: { backgroundColor: '#e8dcc8' },
              animationDurationInMs: 300,
              allowDragging: false,
            }}
          />
        </div>

        {/* Self bar (bottom) */}
        <div className={styles.playerBar} style={{ marginTop: '8px' }}>
          <div className="avatar avatar-sm">
            {getInitials(playerColor === 'white' ? whitePlayer.username : blackPlayer.username)}
          </div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>
              {playerColor === 'white' ? whitePlayer.username : blackPlayer.username} (You)
            </div>
            <div className={styles.playerRating}>
              {playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating}
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className={styles.navControls}>
          <button
            className={styles.navBtn}
            onClick={goToStart}
            disabled={currentMoveIndex === -1}
            title="Go to start (Home)"
          >
            ⏮
          </button>
          <button
            className={styles.navBtn}
            onClick={goToPrev}
            disabled={currentMoveIndex === -1}
            title="Previous move (←)"
          >
            ◀
          </button>
          <button
            className={`${styles.navBtn} ${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
            onClick={togglePlay}
            title="Auto-play (Space)"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className={styles.navBtn}
            onClick={goToNext}
            disabled={currentMoveIndex >= moves.length - 1}
            title="Next move (→)"
          >
            ▶
          </button>
          <button
            className={styles.navBtn}
            onClick={goToEnd}
            disabled={currentMoveIndex >= moves.length - 1}
            title="Go to end (End)"
          >
            ⏭
          </button>
        </div>

        {/* Move indicator */}
        <div className={styles.moveIndicator}>
          {currentMoveIndex === -1
            ? 'Starting position'
            : `Move ${currentMoveIndex + 1} of ${moves.length}`
          }
        </div>
      </div>

      {/* Right Panel - Game Info */}
      <div className={styles.rightPanel}>
        {/* Result Card */}
        <div className={`${styles.resultCard} glass-card`}>
          <div className={styles.resultHeader} style={{ color: getResultColor() }}>
            {getResultText()}
          </div>
          <div className={styles.resultReason}>
            {game.resultReason?.replace(/_/g, ' ')}
          </div>

          {game.whiteRatingAfter && (
            <div className={styles.ratingSection}>
              <div className={styles.ratingRow}>
                <div className="avatar avatar-xs">{getInitials(whitePlayer.username)}</div>
                <span className={styles.ratingName}>{whitePlayer.username}</span>
                <span className={styles.ratingValues}>
                  {game.whiteRatingBefore}
                  <span className={styles.ratingArrow}>→</span>
                  {game.whiteRatingAfter}
                </span>
                <span
                  className={styles.ratingDelta}
                  style={{ color: game.whiteRatingAfter - game.whiteRatingBefore >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                >
                  ({game.whiteRatingAfter - game.whiteRatingBefore >= 0 ? '+' : ''}{game.whiteRatingAfter - game.whiteRatingBefore})
                </span>
              </div>
              <div className={styles.ratingRow}>
                <div className="avatar avatar-xs">{getInitials(blackPlayer.username)}</div>
                <span className={styles.ratingName}>{blackPlayer.username}</span>
                <span className={styles.ratingValues}>
                  {game.blackRatingBefore}
                  <span className={styles.ratingArrow}>→</span>
                  {game.blackRatingAfter}
                </span>
                <span
                  className={styles.ratingDelta}
                  style={{ color: game.blackRatingAfter - game.blackRatingBefore >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}
                >
                  ({game.blackRatingAfter - game.blackRatingBefore >= 0 ? '+' : ''}{game.blackRatingAfter - game.blackRatingBefore})
                </span>
              </div>
            </div>
          )}

          <div className={styles.gameMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Time Control</span>
              <span className={styles.metaValue}>{game.timeControl}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Total Moves</span>
              <span className={styles.metaValue}>{moves.length}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Date</span>
              <span className={styles.metaValue}>
                {new Date(game.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={() => navigate('/history')}>
            ← Back to History
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            🏠 Home
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className={`${styles.shortcutsCard} glass-card`}>
          <h4 className={styles.shortcutsTitle}>⌨️ Keyboard Shortcuts</h4>
          <div className={styles.shortcutsList}>
            <div className={styles.shortcutItem}>
              <kbd className={styles.kbd}>←</kbd> Previous move
            </div>
            <div className={styles.shortcutItem}>
              <kbd className={styles.kbd}>→</kbd> Next move
            </div>
            <div className={styles.shortcutItem}>
              <kbd className={styles.kbd}>Home</kbd> Start
            </div>
            <div className={styles.shortcutItem}>
              <kbd className={styles.kbd}>End</kbd> End
            </div>
            <div className={styles.shortcutItem}>
              <kbd className={styles.kbd}>Space</kbd> Auto-play
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
