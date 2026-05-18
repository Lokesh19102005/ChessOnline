export const RATING_TIERS = {
  'Beginner': { min: 0, max: 799, color: '#9ca3af', class: 'tier-beginner' },
  'Novice': { min: 800, max: 999, color: '#a3e635', class: 'tier-novice' },
  'Intermediate': { min: 1000, max: 1199, color: '#34d399', class: 'tier-intermediate' },
  'Advanced': { min: 1200, max: 1399, color: '#38bdf8', class: 'tier-advanced' },
  'Expert': { min: 1400, max: 1599, color: '#c084fc', class: 'tier-expert' },
  'Candidate Master': { min: 1600, max: 1799, color: '#f472b6', class: 'tier-candidate-master' },
  'Master': { min: 1800, max: 1999, color: '#fbbf24', class: 'tier-master' },
  'International Master': { min: 2000, max: 2199, color: '#fb923c', class: 'tier-international-master' },
  'Grandmaster': { min: 2200, max: Infinity, color: '#ef4444', class: 'tier-grandmaster' }
};

export const TIME_CONTROLS = [
  { label: 'Bullet', value: '1+0', minutes: 1, increment: 0, icon: '⚡' },
  { label: 'Bullet', value: '2+1', minutes: 2, increment: 1, icon: '⚡' },
  { label: 'Blitz', value: '3+0', minutes: 3, increment: 0, icon: '🔥' },
  { label: 'Blitz', value: '3+2', minutes: 3, increment: 2, icon: '🔥' },
  { label: 'Blitz', value: '5+0', minutes: 5, increment: 0, icon: '🔥' },
  { label: 'Rapid', value: '10+0', minutes: 10, increment: 0, icon: '⏱️' },
  { label: 'Rapid', value: '15+10', minutes: 15, increment: 10, icon: '⏱️' },
];

export function getRatingTier(rating) {
  for (const [name, tier] of Object.entries(RATING_TIERS)) {
    if (rating >= tier.min && rating <= tier.max) {
      return { name, ...tier };
    }
  }
  return { name: 'Beginner', ...RATING_TIERS['Beginner'] };
}

export function formatTime(ms) {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getResultText(game, userId) {
  if (game.result === 'draw') return 'Draw';
  const isWhite = game.whitePlayer._id === userId || game.whitePlayer === userId;
  if ((isWhite && game.result === 'white') || (!isWhite && game.result === 'black')) {
    return 'Won';
  }
  return 'Lost';
}

export function getInitials(username) {
  return username ? username.slice(0, 2).toUpperCase() : '??';
}
