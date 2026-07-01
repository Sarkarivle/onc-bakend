/**
 * SearchReranker Module (Architectural Version 8.0)
 * Responsibility: Multi-Factor Neural Reranking.
 */
const LLMProvider = require('../generation/llmProvider');

class SearchReranker {
    /**
     * Reranks candidates based on Semantic Relevance, Freshness, and User Profile.
     */
    static async rank(query, results, profile = {}) {
        if (!results || results.length === 0) return [];

        // 1. Pre-score by Freshness (Static boost)
        const candidates = results.map(job => {
            let score = job.score || 0;
            const createdAt = new Date(job.createdAt || Date.now());
            const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

            // Freshness Boost (Linear decay over 30 days)
            const freshnessBoost = Math.max(0, (30 - daysOld) / 30);
            score += freshnessBoost * 0.2;

            return { ...job, baseScore: score };
        });

        // 2. Neural Precision Reranking (Top 10 only for latency)
        const topCandidates = candidates.sort((a, b) => b.baseScore - a.baseScore).slice(0, 10);

        const prompt = `
Task: Neural Rerank for Job Relevance.
Query: "${query}"
Profile: ${JSON.stringify(profile)}
Jobs:
${topCandidates.map((j, i) => `[ID ${i}]: ${j.title} (${j.organization}) - Qual: ${j.eligibility?.education}`).join('\n')}

Instruction: Return JSON { "rankedIndices": [index1, index2, ...], "confidence": [score1, score2, ...] }
Only include jobs that match the user's qualification and query intent.
`;

        try {
            const decision = await LLMProvider.generateLogic(prompt);
            if (!decision || !decision.rankedIndices) return topCandidates.slice(0, 5);

            return decision.rankedIndices.map((idx, i) => ({
                ...topCandidates[idx],
                score: decision.confidence ? decision.confidence[i] : 0.8
            })).filter(j => j !== undefined);

        } catch (e) {
            console.error("❌ Reranker Error:", e.message);
            return topCandidates.slice(0, 5);
        }
    }
}

module.exports = SearchReranker;
