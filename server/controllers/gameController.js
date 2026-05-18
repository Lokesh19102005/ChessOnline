import Game from '../models/Game.js';

// GET /api/games/history
export const getGameHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const result = req.query.result; // Optional filter: 'white', 'black', 'draw'

    const query = {
      $or: [
        { whitePlayer: req.userId },
        { blackPlayer: req.userId }
      ],
      result: { $ne: 'ongoing' }
    };

    // Filter by result from user's perspective
    if (result === 'wins') {
      query.$or = [
        { whitePlayer: req.userId, result: 'white' },
        { blackPlayer: req.userId, result: 'black' }
      ];
    } else if (result === 'losses') {
      query.$or = [
        { whitePlayer: req.userId, result: 'black' },
        { blackPlayer: req.userId, result: 'white' }
      ];
    } else if (result === 'draws') {
      query.result = 'draw';
    }

    const [games, total] = await Promise.all([
      Game.find(query)
        .populate('whitePlayer', 'username avatar rating')
        .populate('blackPlayer', 'username avatar rating')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Game.countDocuments(query)
    ]);

    res.json({
      games,
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

// GET /api/games/:id
export const getGame = async (req, res, next) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('whitePlayer', 'username avatar rating')
      .populate('blackPlayer', 'username avatar rating');

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json({ game });
  } catch (error) {
    next(error);
  }
};
