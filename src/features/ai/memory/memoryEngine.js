/**
 * MemoryEngine Module (Architectural Version 12.0 - Gemini Pro Standard)
 * Responsibility: Managing Deep Memory, Cross-Session Intelligence, and Dashboard Sync.
 */
const Fact = require('./factModel');
const State = require('./stateModel');
const LLMProvider = require('../generation/core_engine/llmProvider');
const getMemoryAuditorPrompt = require('../prompts/memory_auditor');
const UserProfile = require('../context/userProfile');
const VectorService = require('../knowledge/vectorService');

class MemoryEngine {
    /**
     * SEARCH: Deep Keyword Search over user's long-term memory (Point 35).
     */
    static async searchMemory(userId, query, limit = 5) {
        try {
            if (Fact.db?.readyState !== 1) return [];
            const tokens = this._extractSearchTokens(query);
            if (tokens.length === 0) return [];

            const tokenRegex = new RegExp(tokens.map(this._escapeRegex).join('|'), 'i');
            const categoryRegex = new RegExp(this._escapeRegex(tokens[0]), 'i');

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
            if (!userId || ['User', 'Guest'].includes(userId)) return null;
            const cleanFact = String(factText || '').trim();
            const cleanCategory = String(category || '').trim().toUpperCase();
            if (!cleanFact || !cleanCategory) return null;

            const existing = await Fact.findOne({ userId, category: cleanCategory, fact: cleanFact });
            if (existing) {
                existing.usageCount += 1;
                existing.lastAccessed = Date.now();
                return await existing.save();
            }

            const embedding = await VectorService.generate(`${cleanCategory}: ${cleanFact}`);
            if (!Array.isArray(embedding) || embedding.length === 0) return null;

            return await Fact.create({
                userId,
                category: cleanCategory,
                fact: cleanFact,
                embedding,
                importance,
                confidence: 1.0
            });
        } catch (e) {
            console.error("❌ Save Memory Error:", e.message);
        }
    }

    /**
     * EXTRACTION: LLM-based fact extraction with Dashboard Sync (Point 29).
     */
    static async extractFacts(userId, userQuery, aiResponse) {
        if (!userId || ['User', 'Guest'].includes(userId)) return;
        const q = String(userQuery || "").toLowerCase();
        const skipWords = ["hi", "hello", "namaste", "kaise", "okay", "bye", "naam"];
        if (q.length < 10 || skipWords.some(word => q.includes(word))) return;

        const prompt = getMemoryAuditorPrompt(userQuery, aiResponse);
        try {
            const extractions = await LLMProvider.generateLogic(prompt);
            if (Array.isArray(extractions) && extractions.length > 0) {
                const profileUpdates = {};

                for (const item of extractions) {
                    if (!item || !item.fact || !item.category) continue;

                    // Filter out generic noise
                    const fact = (item.fact || "").toLowerCase();
                    if (fact.includes("chat") || fact.includes("user")) continue;

                    await this.saveMemory(userId, item.category, item.fact, item.importance);

                    // Map specific categories to Profile Sync (Point 29)
                    if (item.category === 'EDUCATION' || item.category === 'QUALIFICATION') {
                        profileUpdates.qualification = item.fact;
                    } else if (item.category === 'LOCATION') {
                        profileUpdates.state = item.fact;
                    } else if (item.category === 'DOB') {
                        profileUpdates.dob = item.fact;
                    }
                }

                // Automatically sync to DB if user profile has empty fields
                if (Object.keys(profileUpdates).length > 0) {
                    await UserProfile.syncToDb(userId, profileUpdates);
                }
            }
        } catch (e) {
            console.error("❌ Extraction Error:", e.message);
        }
    }

    static _calculateScore(memory) {
        const recency = (Date.now() - new Date(memory.lastAccessed)) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.exp(-recency / 14); // 2-week half-life for Gemini Pro depth
        return (memory.importance * 0.4) + (recencyScore * 0.4) + (0.2 * Math.min(memory.usageCount / 10, 1));
    }

    static _extractSearchTokens(query) {
        const stopWords = new Set(['mujhe', 'batao', 'please', 'bhai', 'yaar', 'ke', 'ki', 'ka', 'hai', 'mein', 'me', 'aur']);
        return String(query || '')
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .map(token => token.trim())
            .filter(token => token.length > 1 && !stopWords.has(token))
            .slice(0, 10);
    }

    static _escapeRegex(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = MemoryEngine;
