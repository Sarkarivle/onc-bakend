const mongoose = require('mongoose');

const aiAdviceFeedbackSchema = new mongoose.Schema({
    adviceLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAdviceLog', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: String, enum: ['up', 'down'], required: true },
    reason: { type: String, enum: ['wrong_data', 'wrong_verdict', 'tone', 'language', 'other'] },
    comment: String,
}, { timestamps: true });

aiAdviceFeedbackSchema.index({ adviceLogId: 1 });
aiAdviceFeedbackSchema.index({ rating: 1, createdAt: -1 });
aiAdviceFeedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AiAdviceFeedback', aiAdviceFeedbackSchema);
