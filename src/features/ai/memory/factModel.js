const mongoose = require('mongoose');

/**
 * Fact Schema (Long-Term Semantic Memory)
 * Responsibility: Persistent storage of atomic user facts with vector embeddings.
 */
const factSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true }, // e.g., 'EDUCATION', 'SKILLS', 'GOALS'
    fact: { type: String, required: true },
    embedding: { type: [Number], required: true }, // Vector for semantic search
    importance: { type: Number, default: 0.5 }, // 0 to 1
    confidence: { type: Number, default: 1.0 }, // AI's certainty
    usageCount: { type: Number, default: 0 },
    lastAccessed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false }
});

// Compound index for fast user-specific semantic search
factSchema.index({ userId: 1, embedding: "vector" });

module.exports = mongoose.model('LongTermFact', factSchema);
