const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  location: { type: String, default: 'India' },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // FULLY ELASTIC: Isme sab kuch save hoga jo AI nikalega
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // CORE REQUIREMENTS: Isko bhi Mixed kar diya taaki validation fail na ho
  coreRequirements: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
