/**
 * LLMDetector Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../../../generation/llmProvider');
const buildPrompt = require('./prompts/llmDetector');

class LLMDetector {
    static async classify(query, context = {}) {
        const prompt = buildPrompt(query, context);
        // Pure neural decision from your Llama-3 model
        return await LLMProvider.generate(prompt);
    }
}

module.exports = LLMDetector;
