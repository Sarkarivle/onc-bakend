/**
 * MemoryEngine Module (Architectural Version 7.0 - Dual Memory System)
 * Responsibility: Managing Short-Term (Context) and Long-Term (Fact) Memory.
 */
const Fact = require('./factModel');
const State = require('./stateModel');
const VectorService = require('../knowledge/vectorService');
const LLMProvider = require('../generation/llmProvider');

class MemoryEngine {
    /**
     * SEARCH: Semantic Search over user's long-term memory.
     */
    static async searchMemory(userId, query, limit = 5) {
        try {
            const queryVector = await VectorService.generate(query);
            if (!queryVector) return [];

            // Find facts related to the query for this specific user
            const memories = await Fact.aggregate([
                { $match: { userId, isDeleted: false } },
                {
                    $vectorSearch: {
                        index: "fact_vector_index", // Assumes Atlas Vector Index
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 50,
                        limit: limit
                    }
                }
            ]);

            // Rank by hybrid score: Semantic Similarity + Importance + Recency
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
        const embedding = await VectorService.generate(factText);
        if (!embedding) return;

        // Check for existing similar facts in same category to avoid duplicates
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
            embedding,
            importance,
            confidence: 1.0
        });
    }

    /**
     * EXTRACTION: LLM-based fact extraction from conversation.
     */
    static async extractFacts(userId, userQuery, aiResponse) {
        const prompt = `
Task: Extract long-term user facts from the conversation turn.
Ignore: Small talk, greetings, temporary questions.
Focus: Education, Location, Job Goals, Skills, Experience, Preferences.

[USER]: "${userQuery}"
[AI]: "${aiResponse}"

Output ONLY JSON Array:
[
  { "category": "SKILL|GOAL|EDU|LOC|PREF", "fact": "atomic fact string", "importance": 0.1-1.0 }
]
`;
        try {
            const extractions = await LLMProvider.generateLogic(prompt);
            if (Array.isArray(extractions)) {
                for (const item of extractions) {
                    await this.saveMemory(userId, item.category, item.fact, item.importance);
                }
            }
        } catch (e) {
            console.error("❌ Fact Extraction Error:", e.message);
        }
    }

    /**
     * SHORT-TERM: Get sliding window context.
     */
    static async getShortTermContext(sessionId, windowSize = 5) {
        const state = await State.findOne({ sessionId });
        if (!state || !state.history) return [];
        return state.history.slice(-windowSize);
    }

    static _calculateScore(memory) {
        const recency = (Date.now() - new Date(memory.lastAccessed)) / (1000 * 60 * 60 * 24); // days
        const recencyScore = Math.exp(-recency / 7); // Decay over a week
        return (memory.importance * 0.4) + (recencyScore * 0.4) + (0.2 * Math.min(memory.usageCount / 10, 1));
    }
}

module.exports = MemoryEngine;
