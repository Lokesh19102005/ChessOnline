import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getInitials } from '../../utils/constants';
import styles from './Layout.module.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path ? styles.active : '';

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.navBrand}>
        ♟️ <span>ChessMate</span>
      </Link>

      {/* Desktop nav links */}
      <div className={styles.navLinks}>
        <Link to="/" className={`${styles.navLink} ${isActive('/')}`}>
          🏠 Home
        </Link>
        <Link to="/play" className={`${styles.navLink} ${isActive('/play')}`}>
          ⚔️ Play
        </Link>
        <Link to="/play-computer" className={`${styles.navLink} ${isActive('/play-computer')}`}>
          🤖 Computer
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
            <div className={styles.userInfoText}>
              <div className={styles.userName}>{user.username}</div>
              <div className={styles.userRating}>{user.rating}</div>
            </div>
          </Link>
        )}

        <button className="btn btn-ghost btn-sm" onClick={logout}>
          Logout
        </button>

        {/* Mobile hamburger */}
        <button
          className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && <div className={styles.mobileOverlay} onClick={closeMenu} />}
      
      {/* Mobile slide-out menu */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        <Link to="/" className={`${styles.mobileLink} ${isActive('/')}`} onClick={closeMenu}>
          🏠 Home
        </Link>
        <Link to="/play" className={`${styles.mobileLink} ${isActive('/play')}`} onClick={closeMenu}>
          ⚔️ Play
        </Link>
        <Link to="/play-computer" className={`${styles.mobileLink} ${isActive('/play-computer')}`} onClick={closeMenu}>
          🤖 Computer
        </Link>
        <Link to="/leaderboard" className={`${styles.mobileLink} ${isActive('/leaderboard')}`} onClick={closeMenu}>
          🏆 Leaderboard
        </Link>
        <Link to="/history" className={`${styles.mobileLink} ${isActive('/history')}`} onClick={closeMenu}>
          📜 History
        </Link>
        <Link to="/friends" className={`${styles.mobileLink} ${isActive('/friends')}`} onClick={closeMenu}>
          👥 Friends
        </Link>
        <Link to="/profile" className={`${styles.mobileLink} ${isActive('/profile')}`} onClick={closeMenu}>
          👤 Profile
        </Link>
      </div>
    </nav>
  );
}
