const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class LLMProvider {
    static async getBaseUrl() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let url = setting?.value || constants.DEFAULT_RUNPOD_URL;
        return url.replace(/\/api\/(chat|generate)\/?$/, '').replace(/\/$/, '');
    }

    /**
     * UNBREAKABLE JSON ENGINE (Gemini Style)
     */
    static async generateLogic(prompt) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_LOGIC_MODEL,
                messages: [
                    { role: 'system', content: 'You are a Strict Intent Classifier. Respond ONLY with valid JSON. NO markdown. NO explanation.' },
                    { role: 'user', content: prompt }
                ],
                options: { temperature: 0.1 }
            }, { timeout: 25000 });

            let raw = response.data.message.content.trim();

            // Clean control characters and markdown blocks
            raw = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            const jsonMatch = raw.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.error("❌ LLM failed to return JSON structure.");
                return null;
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error("❌ LLM Logic Engine Error:", error.message);
            return null;
        }
    }

    static async chat(messages) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_PERSONALITY_MODEL,
                messages: messages,
                options: { temperature: 0.7 }
            }, { timeout: 30000 });
            return { content: response.data.message.content };
        } catch (error) {
            console.error("❌ Personality Engine Error:", error.message);
            throw error;
        }
    }

    static async verifyResponse(query, answer, knowledge) {
        const prompt = `Match the AI Answer with Fact Data.\nQuery: ${query}\nFact: ${knowledge}\nAnswer: ${answer}\nReturn JSON: {"isValid":true/false, "correctedAnswer": "..."}`;
        return await this.generateLogic(prompt);
    }

    static async guardResponse(query, answer) {
        const prompt = `Check if safe: User: ${query}\nAI: ${answer}\nReturn "safe" or "unsafe"`;
        const res = await this.generateLogic(prompt);
        return res?.status !== 'unsafe';
    }
}

module.exports = LLMProvider;
