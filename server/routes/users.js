import { Router } from 'express';
import {
  getUserProfile,
  updateProfile,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  searchUsers,
  getFriendRecommendations,
  getUserFriends,
  getConversations
} from '../controllers/userController.js';
import auth from '../middleware/auth.js';

const router = Router();

// These specific routes MUST come before the /:id wildcard route
router.get('/search', auth, searchUsers);
router.get('/recommendations', auth, getFriendRecommendations);
router.get('/conversations', auth, getConversations);
router.put('/profile', auth, updateProfile);
router.post('/friend-request/:requestId/accept', auth, acceptFriendRequest);
router.post('/friend-request/:requestId/decline', auth, declineFriendRequest);
router.delete('/friends/:id', auth, removeFriend);

// Parameterized routes (must be after specific routes)
router.get('/:id', auth, getUserProfile);
router.get('/:id/friends', auth, getUserFriends);
router.post('/:id/friend-request', auth, sendFriendRequest);

export default router;
