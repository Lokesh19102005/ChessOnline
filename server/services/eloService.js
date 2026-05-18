/**
 * Elo Rating Service
 * Implements standard Elo rating calculation with dynamic K-factor.
 * 
 * K-factor: 40 for new players (< 30 games), 20 for established players
 * Starting rating: 1200
 */

/**
 * Get the K-factor based on games played
 */
function getKFactor(gamesPlayed) {
  if (gamesPlayed < 30) return 40;
  return 20;
}

/**
 * Calculate expected score for player A against player B
 * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ratings after a game
 * @param {number} ratingA - Player A's current rating
 * @param {number} ratingB - Player B's current rating
 * @param {number} scoreA - Actual score for player A (1 = win, 0.5 = draw, 0 = loss)
 * @param {number} gamesPlayedA - Player A's total games played
 * @param {number} gamesPlayedB - Player B's total games played
 * @returns {{ newRatingA: number, newRatingB: number, changeA: number, changeB: number }}
 */
export function calculateNewRatings(ratingA, ratingB, scoreA, gamesPlayedA, gamesPlayedB) {
  const scoreB = 1 - scoreA;
  
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = expectedScore(ratingB, ratingA);
  
  const kA = getKFactor(gamesPlayedA);
  const kB = getKFactor(gamesPlayedB);
  
  const changeA = Math.round(kA * (scoreA - expectedA));
  const changeB = Math.round(kB * (scoreB - expectedB));
  
  const newRatingA = Math.max(100, ratingA + changeA); // Floor at 100
  const newRatingB = Math.max(100, ratingB + changeB);
  
  return {
    newRatingA,
    newRatingB,
    changeA,
    changeB
  };
}

/**
 * Get rating tier/badge name
 */
export function getRatingTier(rating) {
  if (rating < 800) return 'Beginner';
  if (rating < 1000) return 'Novice';
  if (rating < 1200) return 'Intermediate';
  if (rating < 1400) return 'Advanced';
  if (rating < 1600) return 'Expert';
  if (rating < 1800) return 'Candidate Master';
  if (rating < 2000) return 'Master';
  if (rating < 2200) return 'International Master';
  return 'Grandmaster';
}

/**
 * Parse time control string (e.g., "10+0" => { baseTime: 600000, increment: 0 })
 * @param {string} timeControl - Format: "minutes+incrementSeconds"
 */
export function parseTimeControl(timeControl) {
  const [minutes, increment] = timeControl.split('+').map(Number);
  return {
    baseTime: minutes * 60 * 1000,    // Convert to ms
    increment: increment * 1000        // Convert to ms
  };
}
