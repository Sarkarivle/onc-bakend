const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // PURE ELASTIC DATA: Isme AI ke saare 18 steps as an array save honge
  // Har item me { heading: "...", type: "table/text", data: "..." } hoga
  jobSpecifications: [{
    heading: String,
    sectionType: { type: String, enum: ['table', 'text', 'list'] },
    sectionData: mongoose.Schema.Types.Mixed
  }],

  // AI Advice ke liye core summary (AI khud extract karega)
  aiCoreSummary: mongoose.Schema.Types.Mixed,

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
