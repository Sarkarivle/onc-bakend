const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class LLMProvider {
    static async getBaseUrl() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let url = setting?.value || constants.DEFAULT_RUNPOD_URL;
        if (!url) return constants.DEFAULT_RUNPOD_URL;

        // Clean the URL: trim whitespace
        url = url.trim();

        // Ensure protocol exists
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        // Remove trailing slashes/api paths
        return url.replace(/\/api\/(chat|generate)\/?$/, '').replace(/\/$/, '');
    }

    /**
     * ROBUST JSON LOGIC ENGINE (Handles multiple API standards)
     */
    static async generateLogic(prompt, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                const baseUrl = await this.getBaseUrl();
                const response = await axios.post(`${baseUrl}/api/chat`, {
                    model: constants.AI_LOGIC_MODEL,
                    messages: [
                        { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    stream: false,
                    options: { temperature: 0.1 }
                }, { timeout: 45000 });

                let raw = "";
                if (response.data.message && response.data.message.content) {
                    raw = response.data.message.content;
                } else if (response.data.choices && response.data.choices[0].message) {
                    raw = response.data.choices[0].message.content;
                } else if (response.data.response) {
                    raw = response.data.response;
                }

                if (!raw) throw new Error("Empty response from LLM");

                let clean = raw.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                const jsonMatch = clean.match(/\{[\s\S]*\}/);

                if (!jsonMatch) {
                    throw new Error("Invalid JSON format in response");
                }

                return JSON.parse(jsonMatch[0]);
            } catch (error) {
                console.warn(`⚠️ LLM Logic Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) {
                    console.error("❌ LLM Logic Engine Error after retries:", error.message);
                    return null;
                }
                // Wait before retry
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }

    static async chat(messages, retries = 1) {
        for (let i = 0; i <= retries; i++) {
            try {
                const baseUrl = await this.getBaseUrl();
                const response = await axios.post(`${baseUrl}/api/chat`, {
                    model: constants.AI_PERSONALITY_MODEL,
                    messages: messages,
                    stream: false,
                    options: { temperature: 0.7 }
                }, { timeout: 60000 });

                let content = "";
                if (response.data.message) content = response.data.message.content;
                else if (response.data.choices) content = response.data.choices[0].message.content;

                return { content };
            } catch (error) {
                console.warn(`⚠️ Personality Engine Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) {
                    console.error("❌ Personality Engine Error after retries:", error.message);
                    throw error;
                }
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    static async chatStream(messages, onChunk) {
        try {
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/api/chat`, {
                model: constants.AI_PERSONALITY_MODEL,
                messages: messages,
                stream: true,
                options: { temperature: 0.7 }
            }, { responseType: 'stream', timeout: 90000 }); // Increased from 60s for streaming

            return new Promise((resolve, reject) => {
                let buffer = '';
                response.data.on('data', chunk => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep partial line in buffer

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                onChunk(json.message.content);
                            } else if (json.response) {
                                onChunk(json.response);
                            }
                            if (json.done) resolve();
                        } catch (e) {
                            // JSON might be split across chunks
                        }
                    }
                });
                response.data.on('error', reject);
                response.data.on('end', () => {
                    if (buffer.trim()) {
                        try {
                            const json = JSON.parse(buffer);
                            if (json.message && json.message.content) onChunk(json.message.content);
                        } catch (e) {}
                    }
                    resolve();
                });
            });
        } catch (error) {
            console.error("❌ LLM Stream Error:", error.message);
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
