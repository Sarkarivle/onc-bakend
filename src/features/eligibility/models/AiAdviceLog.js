const mongoose = require('mongoose');

// One row per AI eligibility-advice generation. Lets a thumbs up/down (AiAdviceFeedback)
// be traced back to exactly what profile, engine verdict and prompt version produced it.
const aiAdviceLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    jobTitle: String,
    promptVersion: { type: String, default: 'v1' },
    userProfileSnapshot: String,
    engineFacts: mongoose.Schema.Types.Mixed,
    banner: String,
    details: String,
}, { timestamps: true });

module.exports = mongoose.model('AiAdviceLog', aiAdviceLogSchema);
