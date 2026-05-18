import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import config from './config/config.js';
import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import setupSocket from './socket/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gameRoutes from './routes/games.js';
import leaderboardRoutes from './routes/leaderboard.js';

const app = express();
const server = createServer(app);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests from any localhost port (Vite may pick different ports)
    if (!origin || origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv 
  });
});

// Error handler (must be last middleware)
app.use(errorHandler);

// Setup Socket.IO
const io = setupSocket(server);

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`
  ♟️  ChessMate Server Running
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌐 Port: ${PORT}
  🔧 Environment: ${config.nodeEnv}
  📡 Socket.IO: Ready
  ━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export { io };
