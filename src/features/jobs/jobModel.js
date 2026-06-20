const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // Ye fields aapki App (UI) ke liye hain
  importantDates: {
    applicationBegin: { type: String, default: 'N/A' },
    applicationLastDate: { type: String, default: 'N/A' },
    feePaymentDeadline: { type: String, default: 'N/A' },
    examDate: { type: String, default: 'As per Schedule' }
  },
  applicationFee: {
    generalObcEws: { type: String, default: 'N/A' },
    scStPh: { type: String, default: 'N/A' },
    female: { type: String, default: 'N/A' }
  },
  eligibility: {
    minAge: { type: String, default: '18 Years' },
    maxAge: { type: String, default: '40 Years' },
    totalVacancy: { type: String, default: 'N/A' },
    salary: { type: String, default: 'Not Disclosed' },
    education: { type: String, default: 'Check Notification' }
  },

  // AI Matching ke liye poora elastic data
  aiCoreSummary: mongoose.Schema.Types.Mixed,
  jobSpecifications: mongoose.Schema.Types.Mixed,

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
