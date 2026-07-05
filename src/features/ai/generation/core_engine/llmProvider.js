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
        expiresAt: 0
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

    static getProvider() {
        return (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
    }

    static async getBaseUrl() {
        const now = Date.now();
        if (this.settingsCache.baseUrl && this.settingsCache.expiresAt > now) {
            return this.settingsCache.baseUrl;
        }

        const provider = this.getProvider();
        let url = process.env.LLM_BASE_URL;

        if (!url) {
            const setting = Settings.db?.readyState === 1
                ? await Settings.findOne({ key: 'RUNPOD_URL' })
                : null;
            url = (setting?.value || constants.DEFAULT_RUNPOD_URL).trim();
        }

        if (!url) {
            const defaultUrl = provider === 'vllm' || provider === 'openai'
                ? 'http://127.0.0.1:8000/v1'
                : constants.DEFAULT_RUNPOD_URL;
            this.settingsCache = { baseUrl: defaultUrl, expiresAt: now + this.SETTINGS_TTL_MS };
            return defaultUrl;
        }

        // ULTRA-ROBUST CLEANING
        if (url.includes('http')) {
            const match = url.match(/https?:\/\/[^\s'"]+/);
            if (match) url = match[0];
        }

        url = url.trim().replace(/['"]/g, ''); // Remove quotes
        url = url.replace(/^(https?:\/\/)+/i, (m) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
        if (!url.startsWith('http')) url = `https://${url}`;
        url = url.replace(/\/+$/, '');

        if (provider === 'vllm' || provider === 'openai') {
            // Ensure v1 path exists and ends with /chat/completions
            url = url.replace(/\/chat\/completions\/?$/i, '');
            if (!url.toLowerCase().endsWith('/v1')) {
                url = `${url}/v1`;
            }
            url = `${url}/chat/completions`;
        } else {
            // Ollama logic
            url = url.replace(/\/api\/(tags|generate|push|pull|show|copy|delete)\/?$/i, '');
            url = url.replace(/\/v1\/(models|chat|completions)\/?$/i, '');
            url = url.replace(/\/api\/?$/i, '');
            url = url.replace(/\/+$/, '');

            if (!url.toLowerCase().includes('/api/chat')) {
                url = `${url}/api/chat`;
            }
        }

        this.settingsCache = { baseUrl: url, expiresAt: now + this.SETTINGS_TTL_MS };
        console.log(`[LLMProvider] Using URL: ${url} (Provider: ${provider})`);
        return url;
    }

    static getModel(type) {
        if (process.env.LLM_MODEL) return process.env.LLM_MODEL;

        if (type === 'logic') return constants.AI_LOGIC_MODEL;
        return constants.AI_PERSONALITY_MODEL;
    }

    /**
     * ROBUST JSON LOGIC ENGINE
     */
    static async generateLogic(prompt, retries = 2) {
        this.callStats.logic++;
        this.callStats.total++;
        const provider = this.getProvider();
        const model = this.getModel('logic');

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                console.log(`[LLMProvider] Calling Logic Model: ${model} at ${fullUrl}`);

                const payload = {
                    model: model,
                    messages: [
                        { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    stream: false,
                    temperature: 0.1
                };

                if (provider === 'ollama') {
                    payload.options = { temperature: 0.1 };
                } else {
                    payload.max_tokens = 1000;
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 45000,
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
        const provider = this.getProvider();
        const model = this.getModel('personality');

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                console.log(`[LLMProvider] Calling Personality Model: ${model} at ${fullUrl}`);

                const payload = {
                    model: model,
                    messages: messages,
                    stream: false,
                    temperature: 0.7
                };

                if (provider === 'ollama') {
                    payload.options = { temperature: 0.7 };
                } else {
                    payload.max_tokens = 1000;
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 90000,
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
        const provider = this.getProvider();
        const model = this.getModel('personality');

        let fullUrl = "";
        try {
            fullUrl = await this.getBaseUrl();
            console.log(`📡 Starting Stream: ${fullUrl} with model ${model} (Provider: ${provider})`);

            const payload = {
                model: model,
                messages: messages,
                stream: true,
                temperature: 0.7
            };

            if (provider === 'ollama') {
                payload.options = { temperature: 0.7 };
            } else {
                payload.max_tokens = 1000;
            }

            const response = await axios.post(fullUrl, payload, {
                responseType: 'stream',
                timeout: 90000,
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
            console.error(`❌ LLM Stream Connection Error (${fullUrl}):`, error.message);
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
