const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  category: { type: String, required: true },
  applyLink: { type: String },
  lastDate: { type: Date },

  // Ye fields App UI ke purane fixed sections ke liye hain (taki N/A na aaye)
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

  // ELASTIC DATA: Isme AI ke saare 18-steps dynamic array me save honge
  // Isme kuch bhi pre-planned nahi hai, AI jo dega wahi yahan dikhega.
  jobSpecifications: [{
    title: String,
    content: String
  }],

  // AI Matching logic ke liye core summary
  aiCoreSummary: mongoose.Schema.Types.Mixed,

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
