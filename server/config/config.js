import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

export default {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chessmate',
  jwtSecret: process.env.JWT_SECRET || 'chessmate_dev_secret_key_2024',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  turn: {
    urls: process.env.TURN_URL ? process.env.TURN_URL.split(',').map(u => u.trim()) : [],
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || ''
  }
};
