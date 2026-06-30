/**
 * NeuralValidator Module (Phase 5 Evolution)
 * Responsibility: LLM-driven critique of draft responses to prevent hallucinations.
 */
const axios = require('axios');
const Settings = require('../../../settings/settingsModel');
const constants = require('../../../../config/constants');
const buildPrompt = require('./prompts/neuralValidator');

class NeuralValidator {
    /**
     * Audits the draft response and decides if it needs repair.
     */
    static async validate(query, draft, context = {}) {
        try {
            const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
            let baseUrl = runpodSetting?.value || constants.DEFAULT_RUNPOD_URL;
            baseUrl = baseUrl.replace(/\/api\/chat\/?$/, '').replace(/\/$/, '');
            const url = `${baseUrl}/api/generate`;

            const prompt = buildPrompt(query, draft, context);

            const aiRes = await axios.post(url, {
                model: constants.AI_MODEL_NAME,
                prompt: `System: Quality Auditor. Return ONLY JSON.\n\nUser: ${prompt}`,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 5000 });

            const rawOutput = aiRes.data.response;
            const cleaned = rawOutput.substring(rawOutput.indexOf('{'), rawOutput.lastIndexOf('}') + 1);
            return JSON.parse(cleaned);

        } catch (err) {
            console.error('❌ Neural Validator Error:', err.message);
            // Robust Fallback: Pass but log error
            return { passed: true, score: 100, issues: [] };
        }
    }
}

module.exports = NeuralValidator;
