const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userMessage: { type: String, required: true },
  aiResponse: { type: String, required: true },
  rating: { type: String, enum: ['up', 'down'], required: true },
  userName: String,
  userLocation: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
