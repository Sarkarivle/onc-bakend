/**
 * NeuralRefiner Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../../generation/llmProvider');
const buildPrompt = require('./prompts/neuralRefiner');

class NeuralRefiner {
    static async refine(rawQuery, context = {}) {
        const prompt = buildPrompt(rawQuery, context);
        const result = await LLMProvider.generateLogic(prompt);

        return {
            originalQuery: rawQuery,
            refinedQuery: result?.refinedQuery || rawQuery,
            isFollowUp: !!result?.isFollowUp
        };
    }
}

module.exports = NeuralRefiner;
