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
     * LOGIC ENGINE: Qwen 2.5 (Intent & Planning)
     */
    static async generateLogic(prompt, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/generate`, {
                model: constants.AI_LOGIC_MODEL,
                prompt: `[INST] Task: Output ONLY valid JSON.\n${prompt} [/INST]\n{`,
                stream: false,
                options: { temperature: 0.1, stop: ["[/INST]"] }
            }, { timeout: 30000 });

            let raw = response.data.response.trim();
            if (!raw.startsWith('{')) raw = '{' + raw;
            raw = raw.replace(/\\_/g, '_').replace(/\\"/g, '"');

            try {
                return JSON.parse(raw);
            } catch (e) {
                const match = raw.match(/\{.*\}/s);
                return match ? JSON.parse(match[0]) : null;
            }
        } catch (error) {
            console.error("❌ Logic Engine Error:", error.message);
            return null;
        }
    }

    /**
     * PERSONALITY ENGINE: Lora_v1 (Chat)
     */
    static async chat(messages, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_PERSONALITY_MODEL,
                messages: messages,
                stream: false,
                options: { temperature: 0.7 }
            }, { timeout: 30000 });

            return { content: response.data.message.content, provider: 'runpod-local' };
        } catch (error) {
            console.error("❌ Personality Engine Error:", error.message);
            throw error;
        }
    }

    /**
     * PERSONALITY ENGINE: Lora_v1 (Streaming Chat)
     */
    static async chatStream(messages, onChunk) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_PERSONALITY_MODEL,
                messages: messages,
                stream: true,
                options: { temperature: 0.7 }
            }, {
                timeout: 30000,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                response.data.on('data', chunk => {
                    const payload = chunk.toString();
                    const lines = payload.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                onChunk(json.message.content);
                            }
                            if (json.done) resolve();
                        } catch (e) {
                            // Partial JSON, wait for more data
                        }
                    }
                });
                response.data.on('error', err => reject(err));
            });
        } catch (error) {
            console.error("❌ Personality Engine Stream Error:", error.message);
            throw error;
        }
    }

    /**
     * REASONING ENGINE: DeepSeek-R1 (Thinking)
     */
    static async generateReasoning(prompt) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/generate`, {
                model: constants.AI_REASONING_MODEL,
                prompt: prompt,
                stream: false,
                options: { temperature: 0.6 }
            }, { timeout: 60000 });
            return response.data.response;
        } catch (error) {
            console.error("❌ Reasoning Engine Error:", error.message);
            return null;
        }
    }

    /**
     * VERIFICATION ENGINE: Llama 3.1 8B (Accuracy Checker)
     */
    static async verifyResponse(originalQuery, aiAnswer, knowledge) {
        try {
            const baseUrl = await this.getBaseUrl();
            const prompt = `Task: Check if the AI Answer accurately reflects the data and answers the query correctly.
User Query: "${originalQuery}"
Fact Data: "${knowledge}"
AI Answer: "${aiAnswer}"

Return ONLY JSON:
{ "isValid": true/false, "reason": "why", "correctedAnswer": "if invalid, provide fixed text" }`;

            const response = await axios.post(`${baseUrl}/api/generate`, {
                model: constants.AI_VERIFY_MODEL,
                prompt: prompt,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 30000 });

            return JSON.parse(response.data.response.match(/\{.*\}/s)[0]);
        } catch (error) {
            console.error("❌ Verification Engine Error:", error.message);
            return { isValid: true };
        }
    }

    /**
     * SECURITY GUARD: Llama-Guard 3 (Safety Filter)
     */
    static async guardResponse(userQuery, aiAnswer) {
        try {
            const baseUrl = await this.getBaseUrl();
            const prompt = `[INST] Task: Check if the following conversation is safe.
User: ${userQuery}
Assistant: ${aiAnswer} [/INST]`;

            const response = await axios.post(`${baseUrl}/api/generate`, {
                model: constants.AI_GUARD_MODEL,
                prompt: prompt,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 30000 });

            const result = response.data.response.trim().toLowerCase();
            const isSafe = result.includes('safe') && !result.includes('unsafe');
            return isSafe;
        } catch (error) {
            console.error("❌ Security Guard Error:", error.message);
            return true;
        }
    }
}

module.exports = LLMProvider;
