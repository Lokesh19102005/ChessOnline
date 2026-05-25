import Message from '../models/Message.js';

export default function chatHandler(io, socket) {
  // Send a chat message in a game room
  socket.on('chat:message', async ({ gameId, content }) => {
    try {
      if (!content || content.trim().length === 0) return;

      const message = await Message.create({
        gameId,
        sender: socket.userId,
        content: content.trim(),
        type: 'text'
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar');

      io.to(gameId).emit('chat:message', populatedMessage.toObject());
    } catch (error) {
      socket.emit('chat:error', { message: error.message });
    }
  });

  // Get chat history for a game
  socket.on('chat:history', async ({ gameId, conversationKey }) => {
    try {
      const query = gameId 
        ? { gameId } 
        : { conversationKey };

      const messages = await Message.find(query)
        .populate('sender', 'username avatar')
        .sort({ createdAt: 1 })
        .limit(100);

      socket.emit('chat:history', { messages, conversationKey: conversationKey || gameId });
    } catch (error) {
      socket.emit('chat:error', { message: error.message });
    }
  });

  // Friend/post-game direct messages
  socket.on('chat:direct', async ({ to, content, conversationKey }) => {
    try {
      if (!content || content.trim().length === 0) return;

      const message = await Message.create({
        conversationKey,
        sender: socket.userId,
        content: content.trim(),
        type: 'text'
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar');

      // Emit to the conversation room
      io.to(conversationKey).emit('chat:message', populatedMessage.toObject());
      
      // Also emit a notification to the recipient for unread badge updates
      io.to(`user_${to}`).emit('chat:new-message-notification', {
        conversationKey,
        message: populatedMessage.toObject()
      });
    } catch (error) {
      socket.emit('chat:error', { message: error.message });
    }
  });

  // Join a conversation room (for friend chat)
  socket.on('chat:join-conversation', ({ conversationKey }) => {
    socket.join(conversationKey);
  });

  // Leave a conversation room
  socket.on('chat:leave-conversation', ({ conversationKey }) => {
    socket.leave(conversationKey);
  });

  // Typing indicators
  socket.on('chat:typing', ({ conversationKey }) => {
    socket.to(conversationKey).emit('chat:typing', {
      userId: socket.userId,
      username: socket.username,
      conversationKey
    });
  });

  socket.on('chat:stop-typing', ({ conversationKey }) => {
    socket.to(conversationKey).emit('chat:stop-typing', {
      userId: socket.userId,
      conversationKey
    });
  });

  // Mark messages as read in a conversation
  socket.on('chat:mark-read', async ({ conversationKey }) => {
    try {
      await Message.updateMany(
        {
          conversationKey,
          sender: { $ne: socket.userId },
          read: false
        },
        {
          $set: { read: true, readAt: new Date() }
        }
      );

      // Notify the other user that their messages were read
      socket.to(conversationKey).emit('chat:messages-read', {
        conversationKey,
        readBy: socket.userId
      });
    } catch (error) {
      socket.emit('chat:error', { message: error.message });
    }
  });
}
