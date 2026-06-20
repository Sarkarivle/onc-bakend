const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  location: { type: String, default: 'India' },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // Elastic Data Field: Isme AI ka pura JSON save hoga
  // Isme sections (Overview, Dates, Fee, etc.) dynamic honge
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Core fields for AI Match logic
  coreRequirements: {
    education: String,
    ageLimit: String,
    feeInfo: mongoose.Schema.Types.Mixed,
    vacancy: String
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
