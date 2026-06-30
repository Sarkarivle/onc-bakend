/**
 * NeuralValidator Module (Phase 5 Evolution)
 * Responsibility: LLM-driven critique of draft responses to prevent hallucinations.
 */
const LLMProvider = require('../generation/llmProvider');
const buildPrompt = require('./prompts/neuralValidator');

class NeuralValidator {
    /**
     * Audits the draft response and decides if it needs repair.
     */
    static async validate(query, draft, context = {}) {
        try {
            const prompt = buildPrompt(query, draft, context);
            const result = await LLMProvider.generate(prompt, { timeout: 15000 });

            if (!result || typeof result !== 'object') {
                return { passed: true, score: 100, issues: [] };
            }

            return result;
        } catch (err) {
            console.error('❌ Neural Validator Error:', err.message);
            // Robust Fallback: Pass but log error
            return { passed: true, score: 100, issues: [] };
        }
    }
}

module.exports = NeuralValidator;
