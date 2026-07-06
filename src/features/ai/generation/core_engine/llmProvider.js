const axios = require('axios');
const http = require('http');
const https = require('https');
const Settings = require('../../../settings/settingsModel');
const constants = require('../../../../config/constants');

// Connection pooling for Turbo Speed
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

class LLMProvider {
    static settingsCache = {
        baseUrl: null,
        expiresAt: 0,
        provider: null
    };
    static SETTINGS_TTL_MS = Number(process.env.LLM_SETTINGS_TTL_MS || 60_000);

    static callStats = {
        logic: 0,
        chat: 0,
        stream: 0,
        total: 0
    };

    static resetStats() {
        this.callStats = { logic: 0, chat: 0, stream: 0, total: 0 };
    }

    static getStats() {
        return { ...this.callStats };
    }

    /**
     * Determines if we are using Ollama or OpenAI/vLLM based on env or URL analysis
     */
    static getProvider(url = '') {
        const envProvider = process.env.LLM_PROVIDER;
        if (envProvider) return envProvider.toLowerCase();

        // Auto-detect based on URL
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('/v1') || lowerUrl.includes('openai') || lowerUrl.includes('runpod') || lowerUrl.includes('cloudflare')) {
            return 'vllm';
        }
        return 'ollama';
    }

    static async getBaseUrl() {
        const now = Date.now();
        if (this.settingsCache.baseUrl && this.settingsCache.expiresAt > now) {
            return this.settingsCache.baseUrl;
        }

        let rawUrl = (process.env.LLM_BASE_URL || '').trim();
        let source = 'Environment';

        if (!rawUrl) {
            // Check Database Settings
            const setting = Settings.db?.readyState === 1
                ? await Settings.findOne({ key: 'RUNPOD_URL' })
                : null;

            if (setting?.value) {
                rawUrl = setting.value.trim();
                source = 'Database';
            } else {
                rawUrl = constants.DEFAULT_RUNPOD_URL.trim();
                source = 'Default Constants';
            }
        }

        // ULTRA-ROBUST CLEANING
        let url = rawUrl;
        if (url.includes('http')) {
            const match = url.match(/https?:\/\/[^\s'"]+/);
            if (match) url = match[0];
        }

        url = url.trim().replace(/['"]/g, ''); // Remove quotes
        url = url.replace(/^(https?:\/\/)+/i, (m) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
        if (!url.startsWith('http')) url = `https://${url}`;

        // DETECT PROVIDER BEFORE STRIPPING
        const provider = this.getProvider(url);

        // Remove all trailing slashes and common endpoints to get a clean base
        url = url.replace(/\/+$/, '');
        url = url.replace(/\/chat\/completions\/?$/i, '');
        url = url.replace(/\/api\/chat\/?$/i, '');
        url = url.replace(/\/v1\/?$/i, '');
        url = url.replace(/\/api\/?$/i, '');
        url = url.replace(/\/+$/, '');

        let finalUrl = url;
        if (provider === 'vllm' || provider === 'openai') {
            finalUrl = `${url}/v1/chat/completions`;
        } else {
            finalUrl = `${url}/api/chat`;
        }

        this.settingsCache = {
            baseUrl: finalUrl,
            expiresAt: now + this.SETTINGS_TTL_MS,
            provider: provider
        };

        console.log(`[LLMProvider] Source: ${source} | URL: ${finalUrl} | Provider: ${provider}`);
        return finalUrl;
    }

    static getModel(type) {
        if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
        if (type === 'logic') return constants.AI_LOGIC_MODEL;
        return constants.AI_PERSONALITY_MODEL;
    }

    /**
     * Common headers for API calls
     */
    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer no-key-needed'
        };
    }

    /**
     * Ensures messages are in the correct format for OpenAI/vLLM
     */
    static sanitizeMessages(messages) {
        if (!Array.isArray(messages)) return [];
        return messages
            .filter(m => m && typeof m === 'object' && ['system', 'user', 'assistant'].includes(m.role))
            .map(m => {
                let content = m.content;
                if (content === null || content === undefined) content = "";
                if (typeof content === 'object') content = JSON.stringify(content);
                return { role: m.role, content: String(content) };
            })
            .filter(m => m.content.trim() !== "");
    }

    /**
     * ROBUST JSON LOGIC ENGINE
     */
    static async generateLogic(prompt, retries = 2) {
        this.callStats.logic++;
        this.callStats.total++;

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                const provider = this.settingsCache.provider;
                const model = this.getModel('logic');

                let payload = {};
                if (provider === 'vllm' || provider === 'openai') {
                    payload = {
                        model: model,
                        messages: this.sanitizeMessages([
                            { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                            { role: 'user', content: prompt }
                        ]),
                        max_tokens: 1000,
                        temperature: 0.1,
                        stream: false
                    };
                    console.log("[LLMProvider] vLLM Logic Payload:", JSON.stringify(payload, null, 2));
                } else {
                    payload = {
                        model: model,
                        messages: [
                            { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                            { role: 'user', content: prompt }
                        ],
                        stream: false,
                        options: { temperature: 0.1 }
                    };
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 45000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                });

                let raw = "";
                if (response.data.choices && response.data.choices[0].message) {
                    raw = response.data.choices[0].message.content;
                } else if (response.data.message && response.data.message.content) {
                    raw = response.data.message.content;
                } else if (response.data.response) {
                    raw = response.data.response;
                }

                if (!raw) throw new Error("Empty response from LLM");

                let clean = raw.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
                const jsonMatch = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

                if (!jsonMatch) {
                    if (clean.startsWith("{") || clean.startsWith("[")) {
                         try { return JSON.parse(clean); } catch (e) {}
                    }
                    throw new Error("Invalid JSON format in response");
                }

                return JSON.parse(jsonMatch[0]);
            } catch (error) {
                if (error.response) {
                    console.error("[LLMProvider] Logic Error status:", error.response.status);
                    console.error("[LLMProvider] Logic Error body:", JSON.stringify(error.response.data, null, 2));
                }
                console.warn(`⚠️ LLM Logic Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) {
                    console.error("❌ LLM Logic Engine Error after retries:", error.message);
                    return null;
                }
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }

    static async chat(messages, retries = 1) {
        this.callStats.chat++;
        this.callStats.total++;

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                const provider = this.settingsCache.provider;
                const model = this.getModel('personality');

                let payload = {};
                if (provider === 'vllm' || provider === 'openai') {
                    payload = {
                        model: model,
                        messages: this.sanitizeMessages(messages),
                        max_tokens: 1000,
                        temperature: 0.7,
                        stream: false
                    };
                    console.log("[LLMProvider] vLLM Chat Payload:", JSON.stringify(payload, null, 2));
                } else {
                    payload = {
                        model: model,
                        messages: messages,
                        stream: false,
                        options: { temperature: 0.7 }
                    };
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 90000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                });

                let content = "";
                if (response.data.choices && response.data.choices[0].message) {
                    content = response.data.choices[0].message.content;
                } else if (response.data.message && response.data.message.content) {
                    content = response.data.message.content;
                } else if (response.data.response) {
                    content = response.data.response;
                } else if (typeof response.data === 'string') {
                    content = response.data;
                }

                return { content };
            } catch (error) {
                if (error.response) {
                    console.error("[LLMProvider] Chat Error status:", error.response.status);
                    console.error("[LLMProvider] Chat Error body:", JSON.stringify(error.response.data, null, 2));
                }
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
        this.callStats.stream++;
        this.callStats.total++;

        try {
            const fullUrl = await this.getBaseUrl();
            const provider = this.settingsCache.provider;
            const model = this.getModel('personality');

            let payload = {};
            if (provider === 'vllm' || provider === 'openai') {
                payload = {
                    model: model,
                    messages: this.sanitizeMessages(messages),
                    max_tokens: 1000,
                    temperature: 0.7,
                    stream: true
                };
                console.log("[LLMProvider] vLLM Stream Payload:", JSON.stringify(payload, null, 2));
            } else {
                payload = {
                    model: model,
                    messages: messages,
                    stream: true,
                    options: { temperature: 0.7 }
                };
            }

            const response = await axios.post(fullUrl, payload, {
                responseType: 'stream',
                timeout: 90000,
                headers: this.getHeaders(),
                httpAgent,
                httpsAgent
            });

            return new Promise((resolve, reject) => {
                let buffer = '';
                let chunkCount = 0;

                response.data.on('data', chunk => {
                    chunkCount++;
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        let text = line.trim();
                        if (!text) continue;

                        if (text.startsWith('data: ')) {
                            text = text.slice(6).trim();
                        }
                        if (text === '[DONE]') {
                            resolve();
                            continue;
                        }

                        try {
                            const json = JSON.parse(text);
                            const content = (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                          (json.message && json.message.content) ||
                                          json.response;
                            if (content) {
                                onChunk(content);
                            }
                            if (json.done) {
                                resolve();
                            }
                        } catch (e) {
                            // Partial JSON
                        }
                    }
                });

                response.data.on('error', (err) => {
                    console.error("❌ Stream Data Error:", err.message);
                    reject(err);
                });

                response.data.on('end', () => {
                    if (buffer.trim()) {
                        try {
                            const text = buffer.startsWith('data: ') ? buffer.slice(6).trim() : buffer.trim();
                            if (text !== '[DONE]') {
                                const json = JSON.parse(text);
                                const content = (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                              (json.message && json.message.content) || json.response;
                                if (content) onChunk(content);
                            }
                        } catch (e) {}
                    }
                    resolve();
                });
            });
        } catch (error) {
            if (error.response) {
                console.error("[LLMProvider] Stream Error status:", error.response.status);
                // For streams, data might be a stream too
                console.error("[LLMProvider] Stream Error body:", error.response.data);
            }
            console.error(`❌ LLM Stream Connection Error:`, error.message);
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
