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
        provider: null,
        apiKey: null
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
     * Determines if we are using Groq, vLLM/OpenAI or Ollama
     */
    static getProvider(url = '') {
        const envProvider = process.env.LLM_PROVIDER;
        if (envProvider) return envProvider.toLowerCase();

        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('groq.com')) return 'groq';
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
        let dbApiKey = null;

        if (!rawUrl) {
            // Check Database Settings
            const urlSetting = Settings.db?.readyState === 1 ? await Settings.findOne({ key: 'RUNPOD_URL' }) : null;
            const keySetting = Settings.db?.readyState === 1 ? await Settings.findOne({ key: 'GROQ_API_KEY' }) : null;

            if (urlSetting?.value) {
                rawUrl = urlSetting.value.trim();
                source = 'Database';
            } else {
                rawUrl = constants.DEFAULT_RUNPOD_URL.trim();
                source = 'Default Constants';
            }
            dbApiKey = keySetting?.value;
        }

        // ULTRA-ROBUST CLEANING
        let url = rawUrl;
        if (url.includes('http')) {
            const match = url.match(/https?:\/\/[^\s'"]+/);
            if (match) url = match[0];
        }

        url = url.trim().replace(/['"]/g, '');
        url = url.replace(/^(https?:\/\/)+/i, (m) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
        if (!url.startsWith('http')) url = `https://${url}`;

        const provider = this.getProvider(url);

        // Remove all trailing slashes and common endpoints to get a clean base
        url = url.replace(/\/+$/, '');
        url = url.replace(/\/chat\/completions\/?$/i, '');
        url = url.replace(/\/api\/chat\/?$/i, '');
        url = url.replace(/\/v1\/?$/i, '');
        url = url.replace(/\/api\/?$/i, '');
        url = url.replace(/\/+$/, '');

        let finalUrl = url;
        if (provider === 'groq') {
            finalUrl = `https://api.groq.com/openai/v1/chat/completions`;
        } else if (provider === 'vllm' || provider === 'openai') {
            finalUrl = `${url}/v1/chat/completions`;
        } else {
            finalUrl = `${url}/api/chat`;
        }

        this.settingsCache = {
            baseUrl: finalUrl,
            expiresAt: now + this.SETTINGS_TTL_MS,
            provider: provider,
            apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || dbApiKey || 'no-key-needed'
        };

        console.log(`[LLMProvider] Source: ${source} | URL: ${finalUrl} | Provider: ${provider}`);
        return finalUrl;
    }

    static getModel(type) {
        // Force stable models for production stability
        const envModel = process.env.LLM_MODEL;
        if (envModel && !envModel.toLowerCase().includes('qwen')) return envModel;

        const provider = this.settingsCache.provider;
        if (provider === 'groq') return "llama-3.3-70b-versatile";

        if (type === 'logic') return constants.AI_LOGIC_MODEL || "llama-3.3-70b-versatile";
        return constants.AI_PERSONALITY_MODEL || "llama-3.3-70b-versatile";
    }

    static getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.settingsCache.apiKey && this.settingsCache.apiKey !== 'no-key-needed') {
            headers['Authorization'] = `Bearer ${this.settingsCache.apiKey}`;
        }
        return headers;
    }

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
        const startTime = Date.now();
        this.callStats.logic++;
        this.callStats.total++;

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                const provider = this.settingsCache.provider;
                const model = this.getModel('logic');

                console.log(`[LLMProvider] Calling Logic Model: ${model} at ${fullUrl}`);

                let payload = {};
                if (provider === 'ollama') {
                    payload = {
                        model: model,
                        messages: [{ role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' }, { role: 'user', content: prompt }],
                        stream: false,
                        options: { temperature: 0.1 }
                    };
                } else {
                    payload = {
                        model: model,
                        messages: this.sanitizeMessages([{ role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' }, { role: 'user', content: prompt }]),
                        max_tokens: Number(process.env.LLM_MAX_TOKENS || 500),
                        temperature: Number(process.env.LLM_TEMPERATURE || 0.1),
                        stream: false
                    };
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 45000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                });

                console.log(`[LLMProvider] Logic duration: ${Date.now() - startTime}ms`);

                let raw = "";
                if (response.data.choices && response.data.choices[0].message) {
                    raw = response.data.choices[0].message.content;
                } else if (response.data.message && response.data.message.content) {
                    raw = response.data.message.content;
                } else if (response.data.response) {
                    raw = response.data.response;
                }

                if (!raw) throw new Error("Empty response from LLM");

                // Aggressive JSON extraction: Find the first '{' and the last '}'
                const firstBrace = raw.indexOf('{');
                const lastBrace = raw.lastIndexOf('}');

                if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                    throw new Error("No valid JSON object found in response");
                }

                const jsonString = raw.substring(firstBrace, lastBrace + 1);
                return JSON.parse(jsonString);
            } catch (error) {
                if (error.response) {
                    console.error("[LLMProvider] Logic Error status:", error.response.status);
                    console.error("[LLMProvider] Logic Error body:", JSON.stringify(error.response.data, null, 2));
                }
                console.warn(`⚠️ LLM Logic Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) return null;
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }

    static async chat(messages, retries = 1, optionsOverride = {}) {
        const startTime = Date.now();
        this.callStats.chat++;
        this.callStats.total++;

        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                const provider = this.settingsCache.provider;
                const model = this.getModel('personality');

                console.log(`[LLMProvider] Calling Personality Model: ${model} at ${fullUrl}`);

                let payload = {};
                if (provider === 'ollama') {
                    payload = {
                        model: model,
                        messages: messages,
                        stream: false,
                        options: {
                            temperature: optionsOverride.temperature || 0.7,
                            num_predict: optionsOverride.max_tokens
                        }
                    };
                } else {
                    payload = {
                        model: model,
                        messages: this.sanitizeMessages(messages),
                        max_tokens: optionsOverride.max_tokens || Number(process.env.LLM_MAX_TOKENS || 350),
                        temperature: 0.7,
                        top_p: 1.0,
                        frequency_penalty: 0.1,
                        presence_penalty: 0.1,
                        stream: false
                    };
                }

                const response = await axios.post(fullUrl, payload, {
                    timeout: 90000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                });

                const duration = Date.now() - startTime;
                console.log(`[LLMProvider] Chat duration: ${duration}ms | Provider: ${provider}`);

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
                if (i === retries) throw error;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    static async chatStream(messages, onChunk) {
        const startTime = Date.now();
        this.callStats.stream++;
        this.callStats.total++;

        try {
            const fullUrl = await this.getBaseUrl();
            const provider = this.settingsCache.provider;
            const model = this.getModel('personality');

            console.log(`📡 Starting Stream: ${fullUrl} with model ${model} (Provider: ${provider})`);

            let payload = {};
            if (provider === 'ollama') {
                payload = {
                    model: model,
                    messages: messages,
                    stream: true,
                    options: { temperature: 0.7 }
                };
            } else {
                payload = {
                    model: model,
                    messages: this.sanitizeMessages(messages),
                    max_tokens: Number(process.env.LLM_MAX_TOKENS || 350),
                    temperature: 0.7,
                    top_p: 1.0,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1,
                    stream: true
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
                response.data.on('data', chunk => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        let text = line.trim();
                        if (!text) continue;

                        if (text.startsWith('data: ')) text = text.slice(6).trim();
                        if (text === '[DONE]') {
                            console.log(`[LLMProvider] Stream duration: ${Date.now() - startTime}ms`);
                            resolve();
                            continue;
                        }

                        try {
                            const json = JSON.parse(text);
                            const content = (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                          (json.message && json.message.content) ||
                                          json.response;
                            if (content) onChunk(content);
                            if (json.done) resolve();
                        } catch (e) {}
                    }
                });

                response.data.on('error', (err) => reject(err));
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
