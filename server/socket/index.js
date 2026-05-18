import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import User from '../models/User.js';
import gameHandler from './gameHandler.js';
import matchmakingHandler from './matchmakingHandler.js';
import chatHandler from './chatHandler.js';
import signalingHandler from './signalingHandler.js';

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

export default function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`⚡ User connected: ${socket.username} (${socket.userId})`);

    // Track online status
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, { isOnline: true });
    io.emit('user:online', { userId: socket.userId });

    // Register all event handlers
    gameHandler(io, socket);
    matchmakingHandler(io, socket);
    chatHandler(io, socket);
    signalingHandler(io, socket);

    // Get ICE server configuration (including metered TURN)
    socket.on('webrtc:get-ice-servers', () => {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      // Add metered TURN server if configured
      if (config.turn.urls && config.turn.urls.length > 0) {
        iceServers.push({
          urls: config.turn.urls,
          username: config.turn.username,
          credential: config.turn.credential
        });
      }

      socket.emit('webrtc:ice-servers', { iceServers });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`💔 User disconnected: ${socket.username}`);

      const userSockets = onlineUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date()
          });
          io.emit('user:offline', { userId: socket.userId });
        }
      }
    });
  });

  return io;
}

export { onlineUsers };
