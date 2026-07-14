const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['JOB', 'SCHOLARSHIP', 'EXAM', 'RESULT', 'ADMIT_CARD', 'GENERAL'],
    default: 'GENERAL'
  },
  url: { type: String, required: true, unique: true },
  officialDomain: { type: String },
  isActive: { type: Boolean, default: true },
  fetchIntervalHours: { type: Number, default: 24 },
  lastFetchedAt: { type: Date },
  lastChangedAt: { type: Date },
  lastStatus: { type: String, enum: ['NEVER_FETCHED', 'UNCHANGED', 'CHANGED', 'FAILED'], default: 'NEVER_FETCHED' },
  lastHttpStatus: { type: Number },
  lastError: { type: String },
  contentHash: { type: String },
  title: { type: String },
  excerpt: { type: String },
  staleAfterHours: { type: Number, default: 72 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

sourceSchema.index({ type: 1, isActive: 1 });
sourceSchema.index({ lastFetchedAt: 1 });
sourceSchema.index({ lastStatus: 1 });

module.exports = mongoose.model('OfficialSource', sourceSchema);
