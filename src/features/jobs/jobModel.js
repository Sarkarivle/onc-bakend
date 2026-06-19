const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  location: { type: String, default: 'India' },
  totalVacancy: { type: String },
  jobType: { type: String, enum: ['Full-time', 'Part-time', 'Contract'], default: 'Full-time' },
  category: { type: String, required: true },
  description: { type: String },
  applyLink: { type: String },
  lastDate: { type: Date },

  // Enhanced Fields
  importantDates: {
    applicationStart: String,
    applicationLastDate: String,
    feePaymentDeadline: String,
    examDate: String
  },
  applicationFee: {
    generalObcEws: String,
    scStPh: String,
    female: String,
    paymentMode: String
  },
  eligibility: {
    education: String,
    ageLimit: String,
    ageNote: String
  },
  physicalEligibility: [{
    parameter: String,
    male: String,
    female: String
  }],
  extraSections: [{
    title: String,
    content: String
  }],

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', jobSchema);
