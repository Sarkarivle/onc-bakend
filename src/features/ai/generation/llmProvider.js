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
     * ROBUST JSON LOGIC ENGINE (Handles multiple API standards)
     */
    static async generateLogic(prompt) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_LOGIC_MODEL,
                messages: [
                    { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                stream: false, // CRITICAL: Ensure non-streaming response
                options: { temperature: 0.1 }
            }, { timeout: 25000 });

            // Robust extraction: Check multiple potential response paths
            let raw = "";
            if (response.data.message && response.data.message.content) {
                raw = response.data.message.content;
            } else if (response.data.choices && response.data.choices[0].message) {
                raw = response.data.choices[0].message.content;
            } else if (response.data.response) {
                raw = response.data.response;
            }

            if (!raw) throw new Error("Empty response from LLM");

            // Deep Clean JSON
            let clean = raw.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            const jsonMatch = clean.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.error("❌ Invalid Response Format:", raw.substring(0, 100));
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
                stream: false,
                options: { temperature: 0.7 }
            }, { timeout: 35000 });

            let content = "";
            if (response.data.message) content = response.data.message.content;
            else if (response.data.choices) content = response.data.choices[0].message.content;

            return { content };
        } catch (error) {
            console.error("❌ Personality Engine Error:", error.message);
            throw error;
        }
    }

    static async verifyResponse(query, answer, knowledge) {
        const prompt = `Fact-Check Task:\nQuery: ${query}\nFact: ${knowledge}\nAI: ${answer}\nReturn JSON: {"isValid":bool, "reason":"why", "correctedAnswer":"..."}`;
        return await this.generateLogic(prompt);
    }

    static async guardResponse(query, answer) {
        const prompt = `Safety Task: Is this response safe? Query: ${query}\nAI: ${answer}\nReturn JSON: {"status":"safe" | "unsafe"}`;
        const res = await this.generateLogic(prompt);
        return res?.status === 'safe';
    }
}

module.exports = LLMProvider;
