import User from '../models/User.js';
import Game from '../models/Game.js';
import Message from '../models/Message.js';
import { getRatingTier } from '../services/eloService.js';

// GET /api/users/:id
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('friends', 'username avatar rating isOnline')
      .populate('friendRequests.from', 'username avatar rating isOnline');
    
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

// GET /api/users/recommendations
export const getFriendRecommendations = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.userId)
      .populate('friends', '_id friends');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const friendIds = currentUser.friends.map(f => f._id.toString());
    const pendingRequestIds = currentUser.friendRequests.map(r => r.from.toString());
    const excludeIds = [req.userId.toString(), ...friendIds, ...pendingRequestIds];

    const recommendations = new Map(); // userId -> { user, score, reasons }

    // 1) Mutual friends — friends of friends
    for (const friend of currentUser.friends) {
      if (!friend.friends) continue;
      for (const fofId of friend.friends) {
        const fofStr = fofId.toString();
        if (excludeIds.includes(fofStr)) continue;
        
        if (!recommendations.has(fofStr)) {
          recommendations.set(fofStr, { userId: fofStr, score: 0, reasons: [], mutualCount: 0 });
        }
        const rec = recommendations.get(fofStr);
        rec.mutualCount++;
        rec.score += 3; // High weight for mutual friends
      }
    }

    // Set mutual friend reason text
    for (const [, rec] of recommendations) {
      if (rec.mutualCount > 0) {
        rec.reasons.push(`${rec.mutualCount} mutual friend${rec.mutualCount > 1 ? 's' : ''}`);
      }
    }

    // 2) Similar rating (±200 ELO), not already in recommendations with high score
    const similarRatingUsers = await User.find({
      _id: { $nin: excludeIds.map(id => id) },
      rating: { $gte: currentUser.rating - 200, $lte: currentUser.rating + 200 }
    })
    .select('_id username avatar rating isOnline')
    .limit(30);

    for (const user of similarRatingUsers) {
      const uid = user._id.toString();
      if (!recommendations.has(uid)) {
        recommendations.set(uid, { userId: uid, score: 0, reasons: [], mutualCount: 0 });
      }
      const rec = recommendations.get(uid);
      rec.score += 2;
      rec.reasons.push('Similar rating');
      rec.userData = user;
    }

    // 3) Recent opponents — players they've played against
    const recentGames = await Game.find({
      $or: [
        { whitePlayer: req.userId },
        { blackPlayer: req.userId }
      ],
      result: { $ne: 'ongoing' }
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('whitePlayer blackPlayer');

    const opponentIds = new Set();
    for (const game of recentGames) {
      const opId = game.whitePlayer.toString() === req.userId.toString()
        ? game.blackPlayer.toString()
        : game.whitePlayer.toString();
      if (!excludeIds.includes(opId)) {
        opponentIds.add(opId);
      }
    }

    for (const opId of opponentIds) {
      if (!recommendations.has(opId)) {
        recommendations.set(opId, { userId: opId, score: 0, reasons: [], mutualCount: 0 });
      }
      const rec = recommendations.get(opId);
      rec.score += 1;
      rec.reasons.push('Recent opponent');
    }

    // Fetch user data for all recommendations that don't have it yet
    const missingUserIds = [];
    for (const [uid, rec] of recommendations) {
      if (!rec.userData) missingUserIds.push(uid);
    }

    if (missingUserIds.length > 0) {
      const users = await User.find({ _id: { $in: missingUserIds } })
        .select('username avatar rating isOnline');
      for (const user of users) {
        const rec = recommendations.get(user._id.toString());
        if (rec) rec.userData = user;
      }
    }

    // Sort by score descending, take top 15
    const sorted = Array.from(recommendations.values())
      .filter(r => r.userData) // only include if we found the user
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(r => ({
        _id: r.userData._id,
        username: r.userData.username,
        avatar: r.userData.avatar,
        rating: r.userData.rating,
        isOnline: r.userData.isOnline,
        reasons: r.reasons,
        mutualFriends: r.mutualCount
      }));

    res.json({ recommendations: sorted });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id/friends
export const getUserFriends = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('friends', 'username avatar rating isOnline');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate mutual friends if viewing another user's friends
    const currentUser = await User.findById(req.userId).select('friends');
    const myFriendIds = currentUser.friends.map(f => f.toString());

    const friends = user.friends.map(f => {
      const friendObj = f.toObject();
      friendObj.isMutual = myFriendIds.includes(f._id.toString());
      return friendObj;
    });

    res.json({ friends });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/conversations
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.userId.toString();

    // Get the current user's friends
    const currentUser = await User.findById(req.userId)
      .populate('friends', 'username avatar rating isOnline');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build conversations from friends list
    const conversations = [];

    for (const friend of currentUser.friends) {
      // Generate the conversationKey (sorted IDs)
      const ids = [userId, friend._id.toString()].sort();
      const conversationKey = `dm_${ids[0]}_${ids[1]}`;

      // Get last message
      const lastMessage = await Message.findOne({ conversationKey })
        .sort({ createdAt: -1 })
        .select('content sender createdAt');

      // Get unread count
      const unreadCount = await Message.countDocuments({
        conversationKey,
        sender: { $ne: req.userId },
        read: false
      });

      conversations.push({
        conversationKey,
        friend: {
          _id: friend._id,
          username: friend.username,
          avatar: friend.avatar,
          rating: friend.rating,
          isOnline: friend.isOnline
        },
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          sender: lastMessage.sender,
          createdAt: lastMessage.createdAt
        } : null,
        unreadCount
      });
    }

    // Sort by last message time (most recent first), then friends without messages
    conversations.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};
