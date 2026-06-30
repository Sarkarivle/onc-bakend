/**
 * QueryRewriter Module (Neural-First)
 * Responsibility: Rewrites queries using neural context instead of keyword regex.
 * Note: Actual rewriting is now handled by NeuralRefiner.
 */
const NeuralRefiner = require('./neuralRefiner');

class QueryRewriter {
    static async rewrite(query, state = {}) {
        // Delegate to the Llama-3 based NeuralRefiner
        // This removes the need for hardcoded keyword lists and regex patterns
        return await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });
    }
}

module.exports = QueryRewriter;
