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
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.0,
                    stop: ["\n", "###"]
                }
            }, { timeout: options.timeout || 30000 });

            let raw = response.data.response.trim();

            // 1. If it's already a JSON-like string, try to parse it
            if (raw.startsWith('{')) {
                try { return JSON.parse(raw); } catch (e) {}
            }

            // 2. RESILIENT EXTRACTION: Look for keywords in the model's "yapping"
            const intents = ["GREETING", "JOB_SEARCH", "FIELD_CHECK", "CAREER_ADVICE", "PROFILE_INQUIRY", "DISCOVERY"];
            const modes = ["JOB_SEARCH", "JOB_DETAILS", "CAREER_GUIDANCE", "GENERAL_HELP", "PROFILE_CHECK"];
            const behaviors = ["RESPOND", "CLARIFY", "GREET"];

            // Check if this was an Intent Detection task
            if (prompt.includes('primaryIntent')) {
                const foundIntent = intents.find(i => raw.toUpperCase().includes(i));
                return { primaryIntent: foundIntent || "GENERAL_QUERY", tone: "POLITE" };
            }

            // Check if this was a Planner task
            if (prompt.includes('Plan for job assistant')) {
                const foundMode = modes.find(m => raw.toUpperCase().includes(m));
                const foundBehavior = behaviors.find(b => raw.toUpperCase().includes(b));
                return {
                    mode: foundMode || "GENERAL_HELP",
                    behavior: foundBehavior || "RESPOND",
                    tools: ["DATABASE"]
                };
            }

            // Default for Refiner: Clean it from conversational fillers
            let cleaned = raw.replace(/^["']|["']$/g, '')
                             .replace(/^(User|Assistant|Refined Query|Instruction): /i, '');

            return { refinedQuery: cleaned || prompt.match(/"([^"]+)"/)?.[1] || "naukri" };

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
