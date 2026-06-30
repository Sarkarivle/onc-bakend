/**
 * LLMDetector Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../../generation/llmProvider');
const buildPrompt = require('./prompts/llmDetector');

class LLMDetector {
    static async classify(query, context = {}) {
        const prompt = buildPrompt(query, context);
        return await LLMProvider.generateLogic(prompt);
    }
}

module.exports = LLMDetector;
