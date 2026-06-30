/**
 * MemoryManager Module (Phase 6: Multi-turn Neural Memory)
 * Responsibility: Extracts facts from conversation and maintains structured user profile.
 */
const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');
const buildPrompt = require('./prompts/memoryManager');

class MemoryManager {
    /**
     * Extracts new facts from the latest conversation turn.
     */
    static async extractInsights(userMsg, aiMsg, currentInsights = {}) {
        try {
            const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
            let baseUrl = runpodSetting?.value || constants.DEFAULT_RUNPOD_URL;
            baseUrl = baseUrl.replace(/\/api\/chat\/?$/, '').replace(/\/$/, '');
            const url = `${baseUrl}/api/generate`;

            const prompt = buildPrompt(userMsg, aiMsg, currentInsights);

            const aiRes = await axios.post(url, {
                model: constants.AI_MODEL_NAME,
                prompt: `System: Memory Extractor. Return ONLY JSON.\n\nUser: ${prompt}`,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 4000 });

            const rawOutput = aiRes.data.response;
            const cleaned = rawOutput.substring(rawOutput.indexOf('{'), rawOutput.lastIndexOf('}') + 1);
            return JSON.parse(cleaned);

        } catch (err) {
            console.error('❌ Memory Manager Error:', err.message);
            return { updatedInsights: currentInsights, turnSummary: "" };
        }
    }
}

module.exports = MemoryManager;
