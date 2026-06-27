const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  sessionId: { type: String, required: true }, // Naya field session tracking ke liye
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  calculation: String,
  suggestions: [String], // Suggestions save karne ke liye
  metadata: mongoose.Schema.Types.Mixed, // Naya field for AI Pipeline metrics (confidence, topic, etc.)
  timestamp: { type: Date, default: Date.now }
});

// Indexing for faster history retrieval
chatSchema.index({ userName: 1, sessionId: 1, timestamp: 1 });

module.exports = mongoose.model('Chat', chatSchema);
