import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaderboardService } from '../../services/services';
import { getRatingTier, getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    loadLeaderboard();
  }, [page]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await leaderboardService.get({ page, limit: 50 });
      setPlayers(res.data.leaderboard);
      setTotalPages(res.data.pagination.pages);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1>🏆 Leaderboard</h1>
        <p>Top players ranked by Elo rating</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : players.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🏆</p>
          <p>No players on the leaderboard yet. Be the first to play!</p>
        </div>
      ) : (
        <table className={styles.leaderboardTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rating</th>
              <th>Tier</th>
              <th>W/L/D</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const tier = getRatingTier(player.rating);
              const rankClass = player.rank <= 3 ? styles[`top${player.rank}`] : '';

              return (
                <tr
                  key={player._id}
                  className={styles.leaderboardRow}
                  onClick={() => navigate(`/profile/${player._id}`)}
                >
                  <td className={`${styles.rank} ${rankClass}`}>
                    {player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
                  </td>
                  <td>
                    <div className={styles.playerCell}>
                      <div className="avatar avatar-sm">{getInitials(player.username)}</div>
                      <span style={{ fontWeight: 600 }}>{player.username}</span>
                    </div>
                  </td>
                  <td className={styles.ratingCell}>{player.rating}</td>
                  <td>
                    <span className={`badge badge-purple`} style={{ color: tier.color }}>
                      {tier.name}
                    </span>
                  </td>
                  <td className={styles.statsCell}>
                    {player.wins}/{player.losses}/{player.draws}
                  </td>
                  <td className={styles.statsCell}>{player.winRate}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Previous
          </button>
          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
