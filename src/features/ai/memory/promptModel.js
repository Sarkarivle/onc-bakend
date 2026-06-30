const mongoose = require('mongoose');

const promptModuleSchema = new mongoose.Schema({
    key: { type: String, required: true }, // e.g., 'CORE', 'GOVT_JOB'
    version: { type: String, required: true }, // e.g., '1.0.0', '1.1.0-beta'
    content: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    experimentWeight: { type: Number, default: 0 }, // 0 to 100 for A/B testing
    updatedBy: String,
    timestamp: { type: Date, default: Date.now }
});

// Composite index for fast lookups
promptModuleSchema.index({ key: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('PromptModule', promptModuleSchema);
