const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  calculation: String,
  suggestions: [String], // Suggestions save karne ke liye
  timestamp: { type: Date, default: Date.now }
});

// Indexing for faster history retrieval
chatSchema.index({ userName: 1, timestamp: 1 });

module.exports = mongoose.model('Chat', chatSchema);
