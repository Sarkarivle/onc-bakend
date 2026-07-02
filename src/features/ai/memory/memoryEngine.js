/**
 * MemoryEngine Module (Architectural Version 8.0 - Standard Memory System)
 * Responsibility: Managing Short-Term (Context) and Long-Term (Fact) Memory without Atlas requirement.
 */
const Fact = require('./factModel');
const State = require('./stateModel');
const LLMProvider = require('../generation/core_engine/llmProvider');

class MemoryEngine {
    /**
     * SEARCH: Efficient Keyword Search over user's long-term memory.
     */
    static async searchMemory(userId, query, limit = 5) {
        try {
            if (Fact.db?.readyState !== 1) return [];
            const tokens = this._extractSearchTokens(query);
            if (tokens.length === 0) return [];

            const tokenRegex = new RegExp(tokens.map(this._escapeRegex).join('|'), 'i');
            const categoryRegex = new RegExp(this._escapeRegex(tokens[0]), 'i');

            // Standard MongoDB search over user's facts
            const memories = await Fact.find({
                userId,
                isDeleted: false,
                $or: [
                    { fact: { $regex: tokenRegex } },
                    { category: { $regex: categoryRegex } }
                ]
            })
            .sort({ lastAccessed: -1, importance: -1 })
            .limit(limit)
            .lean();

            return memories.map(m => ({
                id: m._id,
                fact: m.fact,
                category: m.category,
                score: this._calculateScore(m)
            })).sort((a, b) => b.score - a.score);

        } catch (error) {
            console.error("❌ Memory Search Error:", error.message);
            return [];
        }
    }

    /**
     * SAVE/UPDATE: Atomic user fact persistence.
     */
    static async saveMemory(userId, category, factText, importance = 0.5) {
        try {
            if (Fact.db?.readyState !== 1) return null;
            // Check for existing similar facts to avoid duplicates
            const existing = await Fact.findOne({ userId, category, fact: factText });
            if (existing) {
                existing.usageCount += 1;
                existing.lastAccessed = Date.now();
                return await existing.save();
            }

            return await Fact.create({
                userId,
                category,
                fact: factText,
                importance,
                confidence: 1.0
            });
        } catch (e) {
            console.error("❌ Save Memory Error:", e.message);
        }
    }

    /**
     * EXTRACTION: LLM-based fact extraction from conversation.
     */
    static async extractFacts(userId, userQuery, aiResponse) {
        const q = String(userQuery || "").toLowerCase();
        if (q.length < 5 || q.includes("hi") || q.includes("hello") || q.includes("namaste")) return;

        const prompt = `
Task: Extract long-term user facts.
[USER]: "${userQuery}"
[AI]: "${aiResponse}"
Output ONLY JSON Array: [{ "category": "SKILL|GOAL|EDU|LOC", "fact": "atomic fact", "importance": 0.5 }]
`;
        try {
            const extractions = await LLMProvider.generateLogic(prompt);
            if (Array.isArray(extractions)) {
                for (const item of extractions) {
                    await this.saveMemory(userId, item.category, item.fact, item.importance);
                }
            }
        } catch (e) {}
    }

    /**
     * SHORT-TERM: Get sliding window context.
     */
    static async getShortTermContext(sessionId, windowSize = 5) {
        try {
            if (State.db?.readyState !== 1) return [];
            const state = await State.findOne({ sessionId });
            if (!state || !state.history) return [];
            return state.history.slice(-windowSize);
        } catch (e) { return []; }
    }

    static _calculateScore(memory) {
        const recency = (Date.now() - new Date(memory.lastAccessed)) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.exp(-recency / 7);
        return (memory.importance * 0.4) + (recencyScore * 0.4) + (0.2 * Math.min(memory.usageCount / 10, 1));
    }

    static _extractSearchTokens(query) {
        const stopWords = new Set(['mujhe', 'batao', 'please', 'bhai', 'yaar', 'ke', 'ki', 'ka', 'hai', 'mein', 'me', 'aur', 'the']);
        return String(query || '')
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .map(token => token.trim())
            .filter(token => token.length > 1 && !stopWords.has(token))
            .slice(0, 8);
    }

    static _escapeRegex(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = MemoryEngine;
