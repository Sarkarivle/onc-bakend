const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    userName: { type: String },
    topic: { type: String, default: 'GENERAL' },
    currentTopic: { type: String, default: 'GENERAL' },
    currentDomain: { type: String, default: 'GENERAL' },
    lastDomain: { type: String, default: 'GENERAL' },
    lastUserIntent: { type: String },
    lastAssistantIntent: { type: String },
    pendingAction: { type: String },
    lastShownJobs: [String],
    history: [{
        user: String,
        assistant: String,
        timestamp: { type: Date, default: Date.now }
    }],
    turnCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConversationState', stateSchema);
