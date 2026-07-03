const mongoose = require('mongoose');

const plannerLogSchema = new mongoose.Schema({
    query: { type: String, required: true },
    originalPlan: { type: Object, required: true },
    correctedPlan: { type: Object, default: null },
    status: { type: String, enum: ['pending', 'reviewed', 'flagged'], default: 'pending' },
    userName: { type: String },
    sessionId: { type: String },
    modelUsed: { type: String },
    latency: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PlannerLog', plannerLogSchema);
