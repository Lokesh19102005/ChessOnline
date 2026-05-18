import { Router } from 'express';
import { getGameHistory, getGame } from '../controllers/gameController.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/history', auth, getGameHistory);
router.get('/:id', auth, getGame);

export default router;
