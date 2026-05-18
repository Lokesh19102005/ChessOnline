import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/services';
import { getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await userService.getProfile(user._id);
      setFriends(res.data.user.friends || []);
      setRequests(res.data.user.friendRequests || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    try {
      const res = await userService.searchUsers(searchQuery);
      setSearchResults(res.data.users);
    } catch (err) { console.error(err); }
  };

  const acceptReq = async (fromId) => {
    try {
      await userService.acceptFriendRequest(fromId);
      loadData();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const declineReq = async (fromId) => {
    try {
      await userService.declineFriendRequest(fromId);
      loadData();
    } catch (err) { console.error(err); }
  };

  const removeFriend = async (id) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await userService.removeFriend(id);
      loadData();
    } catch (err) { console.error(err); }
  };

  const sendReq = async (id) => {
    try {
      await userService.sendFriendRequest(id);
      alert('Friend request sent!');
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1>👥 Friends</h1>
        <p>Connect with other players</p>
      </div>

      <div className={styles.tabBar}>
        {['friends', 'requests', 'search'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.active : ''}`}
            onClick={() => setTab(t)}>
            {t === 'friends' ? `Friends (${friends.length})` : t === 'requests' ? `Requests (${requests.length})` : '🔍 Search'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
      ) : tab === 'friends' ? (
        <div className={styles.friendsList}>
          {friends.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No friends yet. Search for players to add!</p>
          ) : friends.map(f => (
            <div key={f._id} className={styles.friendCard}>
              <div className="avatar avatar-sm">{getInitials(f.username)}</div>
              <div className={styles.friendInfo}>
                <div className={styles.friendName}>{f.username}</div>
                <div className={styles.friendRating}>Rating: {f.rating}</div>
              </div>
              <div className={styles.friendStatus}>
                {f.isOnline ? <><span className="online-dot" /> Online</> : 'Offline'}
              </div>
              <div className={styles.friendActions}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/profile/${f._id}`)}>View</button>
                <button className="btn btn-danger btn-sm" onClick={() => removeFriend(f._id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'requests' ? (
        <div className={styles.friendsList}>
          {requests.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No pending requests</p>
          ) : requests.map(r => (
            <div key={r.from?._id || r.from} className={styles.requestCard}>
              <div className="avatar avatar-sm">{getInitials(r.from?.username || '??')}</div>
              <div className={styles.friendInfo}>
                <div className={styles.friendName}>{r.from?.username || 'Unknown'}</div>
              </div>
              <button className="btn btn-success btn-sm" onClick={() => acceptReq(r.from?._id || r.from)}>Accept</button>
              <button className="btn btn-danger btn-sm" onClick={() => declineReq(r.from?._id || r.from)}>Decline</button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={styles.searchBar}>
            <input className="input-field" placeholder="Search by username..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button className="btn btn-primary" onClick={handleSearch}>Search</button>
          </div>
          <div className={styles.friendsList}>
            {searchResults.map(u => (
              <div key={u._id} className={styles.friendCard}>
                <div className="avatar avatar-sm">{getInitials(u.username)}</div>
                <div className={styles.friendInfo}>
                  <div className={styles.friendName}>{u.username}</div>
                  <div className={styles.friendRating}>Rating: {u.rating}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => sendReq(u._id)}>Add Friend</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
