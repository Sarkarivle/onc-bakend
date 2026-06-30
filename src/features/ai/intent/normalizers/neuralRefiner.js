/**
 * NeuralRefiner Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../../generation/llmProvider');
const buildPrompt = require('./prompts/neuralRefiner');

class NeuralRefiner {
    static async refine(rawQuery, context = {}) {
        const prompt = buildPrompt(rawQuery, context);
        // Uses the central engine instead of direct axios
        const result = await LLMProvider.generate(prompt);
        return typeof result === 'string' ? result : (result?.refinedQuery || rawQuery);
    }
}

module.exports = NeuralRefiner;
