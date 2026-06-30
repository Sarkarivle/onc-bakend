/**
 * LLMProvider Module (Master Engine)
 * Responsibility: Centralized connection to your Runpod GPU.
 */
const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class LLMProvider {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || "";
        // Default to personality model for chat/conversations
        this.model = config.model || constants.AI_PERSONALITY_MODEL;

        if (this.baseUrl) {
            console.log(`[AI_CONFIG] 🚀 Using Model: ${this.model} | URL: ${this.baseUrl}`);
        }
    }

    /**
     * Static utility to get base URL from DB or constants
     */
    static async getBaseUrl() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let url = setting?.value || constants.DEFAULT_RUNPOD_URL;
        return url.replace(/\/api\/(chat|generate)\/?$/, '').replace(/\/$/, '');
    }

    /**
     * Instance-based chat (Natural Language)
     */
    async chat(messages, options = {}) {
        try {
            const baseUrl = this.baseUrl || await LLMProvider.getBaseUrl();
            const targetUrl = `${baseUrl}/api/chat`;

            const response = await axios.post(targetUrl, {
                model: this.model,
                messages: messages,
                stream: false,
                options: { temperature: options.temperature || 0.7 }
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

    /**
     * Instance-based streaming chat (SSE)
     */
    async chatStream(messages, onChunk, options = {}) {
        try {
            const baseUrl = this.baseUrl || await LLMProvider.getBaseUrl();
            const targetUrl = `${baseUrl}/api/chat`;

            const response = await axios.post(targetUrl, {
                model: this.model,
                messages: messages,
                stream: true,
                options: { temperature: options.temperature || 0.7 }
            }, {
                timeout: options.timeout || 60000,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let buffer = '';
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message?.content) {
                                onChunk(json.message.content);
                            }
                            if (json.done) resolve();
                        } catch (e) {}
                    }
                });
                response.data.on('error', (err) => reject(err));
                response.data.on('end', () => resolve());
            });
        } catch (error) {
            console.error("❌ Runpod Streaming Error:", error.message);
            throw error;
        }
    }

    /**
     * Static internal thinking & analysis (JSON Mode)
     * Always uses the LOGIC model for accuracy.
     */
    static async generate(prompt, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const targetUrl = `${baseUrl}/api/generate`;

            // Logic model for structured tasks
            const model = constants.AI_LOGIC_MODEL;
            console.log(`[LLM_LOGIC] 🧠 Calling Logic Model: ${model}`);

            const response = await axios.post(targetUrl, {
                model: model,
                prompt: `[INST] Task: Output ONLY valid JSON.\n${prompt} [/INST]\n{`,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    stop: ["[/INST]", "###"]
                }
            }, { timeout: options.timeout || 30000 });

            let raw = response.data.response.trim();

            // Fix Mistral backslash escaping
            raw = raw.replace(/\\_/g, '_').replace(/\\"/g, '"');

            // Deep JSON Extraction: Ensure it starts with {
            if (!raw.startsWith('{')) {
                const firstBrace = raw.indexOf('{');
                if (firstBrace !== -1) {
                    raw = raw.substring(firstBrace);
                } else {
                    raw = '{' + raw;
                }
            }

            // Ensure it ends with }
            if (!raw.endsWith('}')) {
                const lastBrace = raw.lastIndexOf('}');
                if (lastBrace !== -1) {
                    raw = raw.substring(0, lastBrace + 1);
                } else {
                    raw = raw + '}';
                }
            }

            console.log(`[LLM_RAW_LOGIC] 🛰️ Response: ${raw.substring(0, 100)}...`);

            let parsed;
            try {
                parsed = JSON.parse(raw);
                // Unwrapping: If model put it inside "response" or "assistant"
                if (parsed.response) parsed = parsed.response;
                if (parsed.assistant) parsed = parsed.assistant;
                if (parsed.message) parsed = parsed.message;

                return parsed;
            } catch (pErr) {
                // Aggressive cleaning for Mistral-style JSON issues
                const cleaned = raw.replace(/\\n/g, ' ')
                                   .replace(/\n/g, ' ')
                                   .replace(/,\s*([}\]])/g, '$1')
                                   .replace(/(?<![:\{\[,\s])"(?![\s]*[:,\}\]])/g, '\\"');
                try {
                    let aParsed = JSON.parse(cleaned);
                    if (aParsed.response) aParsed = aParsed.response;
                    return aParsed;
                } catch (e) {}
            }
            return null;
        } catch (error) {
            console.error("❌ Runpod Generate Error:", error.message);
            return null;
        }
    }

    /**
     * Static chat helper - uses Personality model
     */
    static async chat(messages, options = {}) {
        const instance = new LLMProvider({ model: constants.AI_PERSONALITY_MODEL });
        return instance.chat(messages, options);
    }
}

module.exports = LLMProvider;
