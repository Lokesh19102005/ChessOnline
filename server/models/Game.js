import mongoose from 'mongoose';

const moveSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  san: { type: String, required: true },       // Standard Algebraic Notation (e.g. "e4", "Nf3")
  promotion: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const gameSchema = new mongoose.Schema({
  whitePlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blackPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pgn: {
    type: String,
    default: ''
  },
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  },
  moves: [moveSchema],
  result: {
    type: String,
    enum: ['white', 'black', 'draw', 'ongoing'],
    default: 'ongoing'
  },
  resultReason: {
    type: String,
    enum: ['checkmate', 'resignation', 'timeout', 'stalemate', 'draw_agreement', 'insufficient_material', 'threefold_repetition', 'fifty_move_rule', 'disconnect', null],
    default: null
  },
  timeControl: {
    type: String,
    default: '10+0'
  },
  whiteTime: {
    type: Number,  // Remaining time in ms
    default: 600000
  },
  blackTime: {
    type: Number,
    default: 600000
  },
  whiteRatingBefore: { type: Number },
  blackRatingBefore: { type: Number },
  whiteRatingAfter: { type: Number },
  blackRatingAfter: { type: Number },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
gameSchema.index({ whitePlayer: 1, createdAt: -1 });
gameSchema.index({ blackPlayer: 1, createdAt: -1 });
gameSchema.index({ result: 1 });

const Game = mongoose.model('Game', gameSchema);
export default Game;
