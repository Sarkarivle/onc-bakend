const mongoose = require('mongoose');

const jansewaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  rating: { type: Number, default: 4.5 },
  formsFilled: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  iconType: { type: String, enum: ['store', 'computer', 'devices'], default: 'store' },
  startingPrice: { type: Number, default: 49 },
  description: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Jansewa', jansewaSchema);
