const mongoose = require('mongoose');

const correctionSchema = new mongoose.Schema({
  originalQuestion: { type: String, required: true },
  badResponse: String,
  correctedResponse: { type: String, required: true },
  category: String, // e.g., 'eligibility', 'dates'
  timestamp: { type: Date, default: Date.now }
});

// Index for fast searching of similar questions
correctionSchema.index({ originalQuestion: 'text' });

module.exports = mongoose.model('Correction', correctionSchema);
