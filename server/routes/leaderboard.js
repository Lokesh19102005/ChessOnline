import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/', auth, getLeaderboard);

export default router;
