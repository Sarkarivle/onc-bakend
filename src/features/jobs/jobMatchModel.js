const mongoose = require('mongoose');

const jobMatchSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },

    matchScore: { type: Number, default: 0 },
    advice: { type: String },

    // UI Column Data
    urgency: { type: String },
    feeText: { type: String },
    ageDesc: { type: String },
    ageStatus: { type: String },
    vacancyText: { type: String },
    eduDesc: { type: String },
    eduStatus: { type: String },

    // Metadata
    lastCalculated: { type: Date, default: Date.now },
    userProfileSnapshot: mongoose.Schema.Types.Mixed // To check if profile changed
});

jobMatchSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('JobMatch', jobMatchSchema);
