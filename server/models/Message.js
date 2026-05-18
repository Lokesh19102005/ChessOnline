import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null
  },
  // For post-game / friend chat, we use a conversationKey
  conversationKey: {
    type: String,
    default: null
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['text', 'system'],
    default: 'text'
  }
}, {
  timestamps: true
});

messageSchema.index({ gameId: 1, createdAt: 1 });
messageSchema.index({ conversationKey: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
