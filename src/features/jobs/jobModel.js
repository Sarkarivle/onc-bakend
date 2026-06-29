const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // App models mapping (Top Level)
  totalVacancy: { type: String, default: 'N/A' },
  salary: { type: String, default: 'Not Disclosed' },

  importantDates: {
    applicationBegin: { type: String, default: 'N/A' },
    applicationLastDate: { type: String, default: 'N/A' },
    feePaymentLastDate: { type: String, default: 'N/A' }, // Changed to match Dart
    examDate: { type: String, default: 'As per Schedule' }
  },
  applicationFee: {
    generalObcEws: { type: String, default: 'N/A' },
    scStPh: { type: String, default: 'N/A' },
    female: { type: String, default: 'N/A' }
  },
  eligibility: {
    education: { type: String, default: 'Check Notification' },
    minAge: { type: String, default: '18 Years' },
    maxAge: { type: String, default: '40 Years' },
    ageLimit: String
  },

  // Dynamic content for "Extra Details" section in App
  jobSpecifications: mongoose.Schema.Types.Mixed,
  fullHtmlContent: { type: String }, // Naya field for Website style HTML
  aiCoreSummary: mongoose.Schema.Types.Mixed,
  fullData: mongoose.Schema.Types.Mixed,

  // Semantic Search (Vector)
  searchVector: { type: [Number], index: false }, // Store embeddings here

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
