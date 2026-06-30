/**
 * LLMProvider Module (Master Engine)
 * Responsibility: Centralized connection to your Runpod GPU (Llama-3-8B).
 */
const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class LLMProvider {
    static async getBaseUrl() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let url = setting?.value || constants.DEFAULT_RUNPOD_URL;
        return url.replace(/\/api\/chat\/?$/, '').replace(/\/$/, '');
    }

    /**
     * Internal thinking & analysis (JSON Mode)
     */
    static async generate(prompt, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/generate`, {
                model: constants.AI_MODEL_NAME,
                prompt: `System: You are an expert logic engine. Return ONLY valid JSON.\n\nUser: ${prompt}`,
                stream: false,
                options: { temperature: options.temperature || 0.1 }
            }, { timeout: options.timeout || 10000 });

            const raw = response.data.response;
            // Extract JSON if AI adds fluff
            const cleaned = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
            return cleaned ? JSON.parse(cleaned) : raw.trim();
        } catch (error) {
            console.error("❌ Runpod Generate Error:", error.message);
            return null;
        }
    }

    /**
     * User-facing chat (Natural Language)
     */
    static async chat(messages, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_MODEL_NAME,
                messages: messages,
                stream: false,
                options: { temperature: options.temperature || 0.5 }
            }, { timeout: options.timeout || 30000 });

            return {
                content: response.data.message.content,
                provider: 'runpod-local'
            };
        } catch (error) {
            console.error("❌ Runpod Chat Error:", error.message);
            throw error;
        }
    }

    // ... we can add chatStream here if needed
}

module.exports = LLMProvider;
