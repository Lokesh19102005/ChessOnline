import { Router } from 'express';
import {
  getUserProfile,
  updateProfile,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers
} from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/search', auth, searchUsers);
router.get('/:id', auth, getUserProfile);
router.put('/profile', auth, updateProfile);
router.post('/:id/friend-request', auth, sendFriendRequest);
router.post('/friend-request/:requestId/accept', auth, acceptFriendRequest);
router.post('/friend-request/:requestId/decline', auth, declineFriendRequest);
router.delete('/friends/:id', auth, removeFriend);

export default router;
