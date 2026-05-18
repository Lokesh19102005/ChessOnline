import Game from '../models/Game.js';
import User from '../models/User.js';
import { parseTimeControl } from '../services/eloService.js';

// Matchmaking queue: Map<timeControl, Array<{ socketId, userId, rating }>>
const queues = new Map();

export default function matchmakingHandler(io, socket) {
  // Join matchmaking queue
  socket.on('matchmaking:join', async ({ timeControl }) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) return socket.emit('matchmaking:error', { message: 'User not found' });

      const tc = timeControl || '10+0';

      if (!queues.has(tc)) {
        queues.set(tc, []);
      }

      const queue = queues.get(tc);

      // Prevent duplicate entries
      const alreadyInQueue = queue.find(p => p.userId === socket.userId);
      if (alreadyInQueue) {
        return socket.emit('matchmaking:error', { message: 'Already in queue' });
      }

      const player = {
        socketId: socket.id,
        userId: socket.userId,
        username: user.username,
        rating: user.rating
      };

      // Try to find a match (within 200 rating points initially, expanding)
      let matched = null;
      let matchIndex = -1;
      const ratingRange = 300;

      for (let i = 0; i < queue.length; i++) {
        const candidate = queue[i];
        if (Math.abs(candidate.rating - player.rating) <= ratingRange) {
          matched = candidate;
          matchIndex = i;
          break;
        }
      }

      if (matched) {
        // Remove matched player from queue
        queue.splice(matchIndex, 1);

        // Randomly assign colors
        const isPlayerWhite = Math.random() < 0.5;
        const whiteUserId = isPlayerWhite ? player.userId : matched.userId;
        const blackUserId = isPlayerWhite ? matched.userId : player.userId;

        const { baseTime } = parseTimeControl(tc);

        // Create game in database
        const game = await Game.create({
          whitePlayer: whiteUserId,
          blackPlayer: blackUserId,
          timeControl: tc,
          whiteTime: baseTime,
          blackTime: baseTime
        });

        const populatedGame = await Game.findById(game._id)
          .populate('whitePlayer', 'username avatar rating')
          .populate('blackPlayer', 'username avatar rating');

        // Notify both players
        const gameData = {
          gameId: game._id.toString(),
          game: populatedGame.toObject(),
          timeControl: tc
        };

        io.to(player.socketId).emit('matchmaking:found', {
          ...gameData,
          color: isPlayerWhite ? 'white' : 'black'
        });

        io.to(matched.socketId).emit('matchmaking:found', {
          ...gameData,
          color: isPlayerWhite ? 'black' : 'white'
        });
      } else {
        // No match found, add to queue
        queue.push(player);
        socket.emit('matchmaking:waiting', {
          position: queue.length,
          timeControl: tc
        });
      }
    } catch (error) {
      socket.emit('matchmaking:error', { message: error.message });
    }
  });

  // Leave matchmaking queue
  socket.on('matchmaking:leave', () => {
    removeFromAllQueues(socket);
    socket.emit('matchmaking:left');
  });

  // Remove from queues on disconnect
  socket.on('disconnect', () => {
    removeFromAllQueues(socket);
  });
}

function removeFromAllQueues(socket) {
  for (const [tc, queue] of queues) {
    const index = queue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }
}

export { queues };
