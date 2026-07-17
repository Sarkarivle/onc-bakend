const mongoose = require('mongoose');

const aiAdviceFeedbackSchema = new mongoose.Schema({
    adviceLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAdviceLog', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: String, enum: ['up', 'down'], required: true },
    reason: { type: String, enum: ['wrong_data', 'wrong_verdict', 'tone', 'language', 'other'] },
    comment: String,
}, { timestamps: true });

module.exports = mongoose.model('AiAdviceFeedback', aiAdviceFeedbackSchema);
