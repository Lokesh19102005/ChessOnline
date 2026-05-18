import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gameService } from '../../services/services';
import { getResultText, getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function History() {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    loadGames();
  }, [filter, page]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter !== 'all') params.result = filter;
      const res = await gameService.getHistory(params);
      setGames(res.data.games);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { key: 'all', label: 'All Games' },
    { key: 'wins', label: 'Wins' },
    { key: 'losses', label: 'Losses' },
    { key: 'draws', label: 'Draws' }
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1>📜 Match History</h1>
        <p>Review your past games</p>
      </div>

      <div className={styles.filterBar}>
        {filters.map(f => (
          <button
            key={f.key}
            className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
            onClick={() => { setFilter(f.key); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📜</p>
          <p>No games found. Start playing to build your history!</p>
        </div>
      ) : (
        games.map((game) => {
          const resultText = getResultText(game, user._id);
          const isWhite = (game.whitePlayer._id || game.whitePlayer) === user._id;
          const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
          const ratingBefore = isWhite ? game.whiteRatingBefore : game.blackRatingBefore;
          const ratingAfter = isWhite ? game.whiteRatingAfter : game.blackRatingAfter;
          const change = ratingAfter && ratingBefore ? ratingAfter - ratingBefore : null;
          const date = new Date(game.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          });

          return (
            <div
              key={game._id}
              className={styles.gameCard}
              onClick={() => navigate(`/game/${game._id}/review`)}
            >
              <span className={`${styles.gameCardResult} ${styles[resultText.toLowerCase()]}`}>
                {resultText}
              </span>
              <div className="avatar avatar-sm">{getInitials(opponent.username)}</div>
              <div className={styles.gameCardInfo}>
                <div className={styles.gameCardOpponent}>
                  vs {opponent.username}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({opponent.rating})</span>
                </div>
                <div className={styles.gameCardMeta}>
                  {game.timeControl} · {game.resultReason?.replace(/_/g, ' ')} · {date} · {game.moves?.length || 0} moves
                </div>
              </div>
              {change !== null && (
                <div className={styles.gameCardRating} style={{ color: change >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  {change >= 0 ? '+' : ''}{change}
                </div>
              )}
            </div>
          );
        })
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← Previous
          </button>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
