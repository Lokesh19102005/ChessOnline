import User from '../models/User.js';
import { getRatingTier } from '../services/eloService.js';

// GET /api/leaderboard
export const getLeaderboard = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      User.find({ gamesPlayed: { $gt: 0 } })
        .select('username avatar rating peakRating gamesPlayed wins losses draws')
        .sort({ rating: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments({ gamesPlayed: { $gt: 0 } })
    ]);

    const leaderboard = players.map((player, index) => ({
      rank: skip + index + 1,
      ...player.toObject(),
      ratingTier: getRatingTier(player.rating),
      winRate: player.gamesPlayed > 0
        ? Math.round((player.wins / player.gamesPlayed) * 100)
        : 0
    }));

    res.json({
      leaderboard,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};
