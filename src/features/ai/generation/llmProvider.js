/**
 * LLMProvider Module (Master Engine)
 * Responsibility: Centralized connection to your Runpod GPU (Llama-3-8B/70B).
 * Supports both static utility calls and instance-based orchestration.
 */
const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class LLMProvider {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || "";
        this.model = config.model || constants.AI_MODEL_NAME;

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
        // Clean URL to handle both proxy and local IP formats
        return url.replace(/\/api\/(chat|generate)\/?$/, '').replace(/\/$/, '');
    }

    /**
     * Instance-based chat (Natural Language)
     */
    async chat(messages, options = {}) {
        try {
            // Ensure URL ends in /api/chat for Chat API
            const targetUrl = this.baseUrl.endsWith('/api/chat') ? this.baseUrl : `${this.baseUrl.replace(/\/$/, '')}/api/chat`;

            const response = await axios.post(targetUrl, {
                model: this.model,
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

    /**
     * Instance-based streaming chat (SSE)
     */
    async chatStream(messages, onChunk, options = {}) {
        try {
            const response = await axios.post(this.baseUrl, {
                model: this.model,
                messages: messages,
                stream: true,
                options: { temperature: options.temperature || 0.5 }
            }, {
                timeout: options.timeout || 60000,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let buffer = '';
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep partial line in buffer

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message?.content) {
                                onChunk(json.message.content);
                            }
                            if (json.done) resolve();
                        } catch (e) {
                            // Ignore parse errors for partial chunks
                        }
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
     * Kept for backward compatibility with detectors and refiners.
     */
    static async generate(prompt, options = {}) {
        try {
            const baseUrl = await this.getBaseUrl();
            const targetUrl = `${baseUrl}/api/generate`;

            const response = await axios.post(targetUrl, {
                model: constants.AI_MODEL_NAME,
                prompt: `### Instruction:
You are an expert system that output ONLY valid JSON.
Task: ${prompt}

### Response:
{`,
                stream: false,
                options: {
                    temperature: options.temperature || 0.1,
                    top_p: 0.9,
                    stop: ["###", "Instruction:", "Response:"]
                }
            }, { timeout: options.timeout || 30000 });

            let raw = response.data.response;
            // Since we pre-filled '{' in the prompt to force JSON, we add it back to the result
            if (raw && !raw.trim().startsWith('{')) raw = '{' + raw;

            // Aggressive JSON Extraction
            const startIdx = raw.indexOf('{');
            const endIdx = raw.lastIndexOf('}');

            if (startIdx !== -1 && endIdx !== -1) {
                const cleaned = raw.substring(startIdx, endIdx + 1)
                    .replace(/\\n/g, ' ')
                    .replace(/\n/g, ' ')
                    .replace(/,\s*([}\]])/g, '$1');

                try {
                    return JSON.parse(cleaned);
                } catch (pErr) {
                    const aggressive = cleaned.replace(/(?<![:\{\[,\s])"(?![\s]*[:,\}\]])/g, '\\"');
                    try { return JSON.parse(aggressive); } catch (e) { }
                }
            }

            return raw.trim();
        } catch (error) {
            console.error("❌ Runpod Generate Error:", error.message);
            return null;
        }
    }

    /**
     * Static chat fallback
     */
    static async chat(messages, options = {}) {
        const baseUrl = await this.getBaseUrl();
        const instance = new LLMProvider({
            baseUrl: `${baseUrl}/api/chat`,
            model: constants.AI_MODEL_NAME
        });
        return instance.chat(messages, options);
    }
}

module.exports = LLMProvider;
