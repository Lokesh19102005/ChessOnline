import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getInitials } from '../../utils/constants';
import styles from './Layout.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? styles.active : '';

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.navBrand}>
        ♟️ <span>ChessMate</span>
      </Link>

      <div className={styles.navLinks}>
        <Link to="/" className={`${styles.navLink} ${isActive('/')}`}>
          🏠 Home
        </Link>
        <Link to="/play" className={`${styles.navLink} ${isActive('/play')}`}>
          ⚔️ Play
        </Link>
        <Link to="/leaderboard" className={`${styles.navLink} ${isActive('/leaderboard')}`}>
          🏆 Leaderboard
        </Link>
        <Link to="/history" className={`${styles.navLink} ${isActive('/history')}`}>
          📜 History
        </Link>
        <Link to="/friends" className={`${styles.navLink} ${isActive('/friends')}`}>
          👥 Friends
        </Link>
      </div>

      <div className={styles.navRight}>
        <div className={`${styles.connectionStatus} ${connected ? styles.online : styles.offline}`}
             title={connected ? 'Connected' : 'Disconnected'} />
        
        {user && (
          <Link to="/profile" className={styles.userInfo}>
            <div className="avatar avatar-sm">
              {getInitials(user.username)}
            </div>
            <div>
              <div className={styles.userName}>{user.username}</div>
              <div className={styles.userRating}>{user.rating}</div>
            </div>
          </Link>
        )}

        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
