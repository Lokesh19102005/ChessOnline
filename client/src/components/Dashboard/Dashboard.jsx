import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { gameService } from '../../services/services';
import { TIME_CONTROLS, getRatingTier, getResultText, getInitials } from '../../utils/constants';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [selectedTC, setSelectedTC] = useState('10+0');
  const [searching, setSearching] = useState(false);
  const [recentGames, setRecentGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);

  const tier = getRatingTier(user?.rating || 1200);

  // Load recent games
  useEffect(() => {
    loadRecentGames();
  }, []);

  // Listen for match found
  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = ({ gameId, color }) => {
      setSearching(false);
      navigate(`/game/${gameId}`, { state: { color } });
    };

    const handleWaiting = () => {
      setSearching(true);
    };

    socket.on('matchmaking:found', handleMatchFound);
    socket.on('matchmaking:waiting', handleWaiting);

    return () => {
      socket.off('matchmaking:found', handleMatchFound);
      socket.off('matchmaking:waiting', handleWaiting);
    };
  }, [socket, navigate]);

  const loadRecentGames = async () => {
    try {
      const res = await gameService.getHistory({ limit: 5 });
      setRecentGames(res.data.games);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const handlePlay = () => {
    if (!socket) return;
    if (searching) {
      socket.emit('matchmaking:leave');
      setSearching(false);
    } else {
      socket.emit('matchmaking:join', { timeControl: selectedTC });
    }
  };

  const winRate = user?.gamesPlayed > 0
    ? Math.round((user.wins / user.gamesPlayed) * 100)
    : 0;

  return (
    <div className={styles.dashboard}>
      {/* Welcome */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeText}>
          <h1>Welcome, <span>{user?.username}</span> 👋</h1>
          <p>
            <span className={tier.class} style={{ fontWeight: 600 }}>{tier.name}</span>
            {' · '}Rating {user?.rating}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon}>⚔️</div>
          <div className={styles.statValue}>{user?.gamesPlayed || 0}</div>
          <div className={styles.statLabel}>Games Played</div>
        </div>
        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon}>🏆</div>
          <div className={styles.statValue}>{user?.wins || 0}</div>
          <div className={styles.statLabel}>Wins</div>
        </div>
        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statValue}>{winRate}%</div>
          <div className={styles.statLabel}>Win Rate</div>
        </div>
        <div className={`${styles.statCard} glass-card`}>
          <div className={styles.statIcon}>⭐</div>
          <div className={styles.statValue}>{user?.peakRating || 1200}</div>
          <div className={styles.statLabel}>Peak Rating</div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainGrid}>
        {/* Play Section */}
        <div className={`${styles.section} glass-card`}>
          <h2 className={styles.sectionTitle}>⚔️ Quick Play</h2>

          <div className={styles.timeControlGrid}>
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc.value}
                className={`${styles.timeControlBtn} ${selectedTC === tc.value ? styles.selected : ''}`}
                onClick={() => setSelectedTC(tc.value)}
              >
                <span className={styles.tcIcon}>{tc.icon}</span>
                <span className={styles.tcValue}>{tc.value}</span>
                <span className={styles.tcLabel}>{tc.label}</span>
              </button>
            ))}
          </div>

          <button
            className={`btn ${searching ? 'btn-danger' : 'btn-primary'} ${styles.playButton}`}
            onClick={handlePlay}
            style={{ marginTop: '16px' }}
          >
            {searching ? (
              <>
                <span className="spinner" /> Searching... Cancel
              </>
            ) : (
              '⚔️ Find Match'
            )}
          </button>
        </div>

        {/* Recent Games */}
        <div className={`${styles.section} glass-card`}>
          <h2 className={styles.sectionTitle}>📜 Recent Games</h2>

          {loadingGames ? (
            <div className={styles.emptyState}>
              <span className="spinner spinner-lg" />
            </div>
          ) : recentGames.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>♟️</div>
              <p>No games yet. Play your first match!</p>
            </div>
          ) : (
            recentGames.map((game) => {
              const resultText = getResultText(game, user._id);
              const isWhite = (game.whitePlayer._id || game.whitePlayer) === user._id;
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const ratingBefore = isWhite ? game.whiteRatingBefore : game.blackRatingBefore;
              const ratingAfter = isWhite ? game.whiteRatingAfter : game.blackRatingAfter;
              const change = ratingAfter - ratingBefore;

              return (
                <div
                  key={game._id}
                  className={styles.recentGame}
                  onClick={() => navigate(`/game/${game._id}/review`)}
                >
                  <div className="avatar avatar-sm">
                    {getInitials(opponent.username)}
                  </div>
                  <div className={styles.gameInfo}>
                    <div className={styles.gameOpponent}>{opponent.username}</div>
                    <div className={styles.gameMeta}>
                      {game.timeControl} · {game.resultReason}
                    </div>
                  </div>
                  <span className={`${styles.gameResult} ${styles[resultText.toLowerCase()]}`}>
                    {resultText}
                  </span>
                  {change !== undefined && !isNaN(change) && (
                    <span className={`${styles.ratingChange} ${change >= 0 ? styles.positive : styles.negative}`}>
                      {change >= 0 ? '+' : ''}{change}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
