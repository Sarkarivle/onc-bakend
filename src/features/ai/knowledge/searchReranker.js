/**
 * SearchReranker Module (Phase 7: Neural Reranking)
 * Responsibility: Ranks raw database results using Llama-3 reasoning.
 */
const LLMProvider = require('../generation/llmProvider');
const buildPrompt = require('./prompts/rerankerPrompt');

class SearchReranker {
    /**
     * Reranks job results using AI logic.
     */
    static async rank(query, results, profile = {}) {
        if (!results || results.length === 0) return [];
        if (results.length === 1) return results; // No need to rank one item

        try {
            // Format results for the LLM (titles and snippets only)
            const formattedResults = results.map(j =>
                `JOB: ${j.title} | Org: ${j.organization} | Qual: ${j.eligibility?.education || 'N/A'} | Loc: ${j.location || 'N/A'}`
            );

            const prompt = buildPrompt(query, formattedResults, profile);
            const decision = await LLMProvider.generate(prompt);

            if (!decision || !decision.rankedIndices || decision.rankedIndices.length === 0) {
                console.warn("⚠️ Reranker returned no indices, using original order.");
                return results.slice(0, 5);
            }

            // Map indices back to original objects
            const rankedResults = decision.rankedIndices
                .map(index => results[index])
                .filter(job => job !== undefined);

            return rankedResults;
        } catch (error) {
            console.error("❌ Neural Reranker Error:", error.message);
            return results.slice(0, 5); // Fallback to first 5
        }
    }
}

module.exports = SearchReranker;
