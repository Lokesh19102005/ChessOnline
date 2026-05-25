import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/services';
import { getRatingTier, getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [profileFriends, setProfileFriends] = useState([]);
  const [showAllFriends, setShowAllFriends] = useState(false);

  const isOwnProfile = !id || id === currentUser?._id;
  const userId = id || currentUser?._id;

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      const [profileRes, friendsRes] = await Promise.all([
        userService.getProfile(userId),
        userService.getUserFriends(userId)
      ]);
      setProfile(profileRes.data.user);
      setBio(profileRes.data.user.bio || '');
      setProfileFriends(friendsRes.data.friends || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const saveBio = async () => {
    try {
      await userService.updateProfile({ bio });
      setEditing(false);
      if (isOwnProfile) updateUser({ bio });
    } catch (error) { console.error(error); }
  };

  const sendFriendReq = async () => {
    try {
      await userService.sendFriendRequest(userId);
      alert('Friend request sent!');
    } catch (error) { alert(error.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}><div className="spinner spinner-lg" /></div>;
  if (!profile) return <div className={styles.pageContainer}><p style={{textAlign:'center',color:'var(--text-muted)',padding:'60px'}}>User not found</p></div>;

  const tier = getRatingTier(profile.rating);
  const winRate = profile.gamesPlayed > 0 ? Math.round((profile.wins / profile.gamesPlayed) * 100) : 0;

  // Determine if already friends
  const isFriend = profile.friends?.some(f => {
    const fId = f._id || f;
    return fId === currentUser?._id;
  });

  const displayFriends = showAllFriends ? profileFriends : profileFriends.slice(0, 8);

  return (
    <div className={styles.pageContainer}>
      <div className={`${styles.profileHeader} glass-card`}>
        <div className="avatar avatar-xl">{getInitials(profile.username)}</div>
        <div className={styles.profileInfo}>
          <h2>{profile.username}</h2>
          <span className="badge badge-purple" style={{ color: tier.color, marginBottom: 8, display:'inline-flex' }}>{tier.name} · {profile.rating}</span>
          {isOwnProfile && editing ? (
            <div style={{ display:'flex',gap:8,marginTop:8 }}>
              <input className="input-field" value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell us about yourself..." maxLength={300} style={{maxWidth:300}} />
              <button className="btn btn-primary btn-sm" onClick={saveBio}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <p className={styles.profileBio}>{profile.bio || (isOwnProfile ? 'No bio yet.' : 'No bio yet.')}</p>
          )}
          <div style={{ display:'flex',gap:8,marginTop:12 }}>
            {isOwnProfile && !editing && <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(true)}>✏️ Edit Bio</button>}
            {!isOwnProfile && !isFriend && <button className="btn btn-primary btn-sm" onClick={sendFriendReq}>👤 Add Friend</button>}
            {!isOwnProfile && isFriend && <span className="badge badge-green" style={{ padding: '6px 14px' }}>✓ Friends</span>}
          </div>
        </div>
      </div>

      <div className={styles.profileStatsGrid}>
        {[
          { v: profile.gamesPlayed, l: 'Games Played' },
          { v: profile.wins, l: 'Wins', c: 'var(--accent-success)' },
          { v: profile.losses, l: 'Losses', c: 'var(--accent-danger)' },
          { v: profile.draws, l: 'Draws', c: 'var(--accent-warning)' },
          { v: `${winRate}%`, l: 'Win Rate' },
          { v: profile.peakRating, l: 'Peak Rating' }
        ].map((s,i) => (
          <div key={i} className={`${styles.profileStat} glass-card`}>
            <div className={styles.profileStatValue} style={s.c ? {color:s.c} : {}}>{s.v}</div>
            <div className={styles.profileStatLabel}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Friends Section */}
      <div className={styles.profileFriendsSection}>
        <div className={styles.profileFriendsHeader}>
          <h3>👥 Friends ({profileFriends.length})</h3>
          {isOwnProfile && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/friends')}>
              Manage Friends
            </button>
          )}
        </div>

        {profileFriends.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isOwnProfile ? 'No friends yet. Visit the Social Hub to find players!' : 'This player hasn\'t added any friends yet.'}
          </p>
        ) : (
          <>
            <div className={styles.profileFriendsGrid}>
              {displayFriends.map(f => (
                <div key={f._id} className={styles.profileFriendCard} onClick={() => navigate(`/profile/${f._id}`)}>
                  <div className={styles.friendAvatarWrap}>
                    <div className="avatar avatar-sm">{getInitials(f.username)}</div>
                    {f.isOnline && <span className={styles.onlineBadge} />}
                  </div>
                  <div>
                    <div className={styles.profileFriendName}>{f.username}</div>
                    <div className={styles.profileFriendRating}>⭐ {f.rating}</div>
                    {!isOwnProfile && f.isMutual && (
                      <span className={styles.mutualBadge}>Mutual</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {profileFriends.length > 8 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 'var(--space-md)', width: '100%' }}
                onClick={() => setShowAllFriends(!showAllFriends)}>
                {showAllFriends ? 'Show Less' : `View All ${profileFriends.length} Friends`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
