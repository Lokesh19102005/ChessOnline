import User from '../models/User.js';
import { getRatingTier } from '../services/eloService.js';

// GET /api/users/:id
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('friends', 'username avatar rating isOnline');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = user.toSafeObject();
    profile.ratingTier = getRatingTier(user.rating);
    profile.winRate = user.gamesPlayed > 0 
      ? Math.round((user.wins / user.gamesPlayed) * 100) 
      : 0;

    res.json({ user: profile });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/profile
export const updateProfile = async (req, res, next) => {
  try {
    const { bio, avatar } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.userId, updates, { 
      new: true, 
      runValidators: true 
    });
    
    res.json({ user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/:id/friend-request
export const sendFriendRequest = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.userId;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already friends
    if (targetUser.friends.includes(currentUserId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Check if request already sent
    const existingRequest = targetUser.friendRequests.find(
      r => r.from.toString() === currentUserId.toString()
    );
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    targetUser.friendRequests.push({ from: currentUserId });
    await targetUser.save();

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/friend-request/:requestId/accept
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const fromUserId = req.params.requestId;
    const currentUser = await User.findById(req.userId);

    const requestIndex = currentUser.friendRequests.findIndex(
      r => r.from.toString() === fromUserId
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Add each other as friends
    currentUser.friendRequests.splice(requestIndex, 1);
    currentUser.friends.addToSet(fromUserId);
    await currentUser.save();

    await User.findByIdAndUpdate(fromUserId, {
      $addToSet: { friends: req.userId }
    });

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/friend-request/:requestId/decline
export const declineFriendRequest = async (req, res, next) => {
  try {
    const fromUserId = req.params.requestId;
    const currentUser = await User.findById(req.userId);

    currentUser.friendRequests = currentUser.friendRequests.filter(
      r => r.from.toString() !== fromUserId
    );
    await currentUser.save();

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/friends/:id
export const removeFriend = async (req, res, next) => {
  try {
    const friendId = req.params.id;

    await User.findByIdAndUpdate(req.userId, {
      $pull: { friends: friendId }
    });
    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: req.userId }
    });

    res.json({ message: 'Friend removed' });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/search?q=username
export const searchUsers = async (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.userId }
    })
    .select('username avatar rating isOnline')
    .limit(20);

    res.json({ users });
  } catch (error) {
    next(error);
  }
};
