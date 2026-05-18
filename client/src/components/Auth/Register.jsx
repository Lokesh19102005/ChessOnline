import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    if (username.length < 3) {
      return setError('Username must be at least 3 characters');
    }

    setLoading(true);

    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <span className={styles.floatingPieces}>♔</span>
      <span className={styles.floatingPieces}>♞</span>
      <span className={styles.floatingPieces}>♜</span>
      <span className={styles.floatingPieces}>♝</span>

      <div className={styles.authContainer}>
        <div className={`${styles.authCard} glass-card`}>
          <div className={styles.authLogo}>
            <span className={styles.logoIcon}>♟️</span>
            <h1>Join ChessMate</h1>
            <p>Start your chess journey</p>
          </div>

          <form className={styles.authForm} onSubmit={handleSubmit}>
            {error && <div className={styles.authError}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className="input-label" htmlFor="register-username">Username</label>
              <input
                id="register-username"
                type="text"
                className="input-field"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                minLength={3}
                maxLength={20}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className="input-label" htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                className="input-field"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className="input-label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                className="input-field"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className="input-label" htmlFor="register-confirm">Confirm Password</label>
              <input
                id="register-confirm"
                type="password"
                className="input-field"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <div className={styles.authFooter}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
