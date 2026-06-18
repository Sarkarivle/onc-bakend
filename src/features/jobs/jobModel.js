const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  location: { type: String, required: true },
  salary: { type: String },
  jobType: { type: String, enum: ['Full-time', 'Part-time', 'Contract'], default: 'Full-time' },
  category: { type: String, required: true },
  description: { type: String },
  applyLink: { type: String },
  lastDate: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
