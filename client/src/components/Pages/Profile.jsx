import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/services';
import { getRatingTier, getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');

  const isOwnProfile = !id || id === currentUser?._id;
  const userId = id || currentUser?._id;

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      const res = await userService.getProfile(userId);
      setProfile(res.data.user);
      setBio(res.data.user.bio || '');
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
            {!isOwnProfile && <button className="btn btn-primary btn-sm" onClick={sendFriendReq}>👤 Add Friend</button>}
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
    </div>
  );
}
