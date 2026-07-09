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

        return finalUrl;
    }

    static getModel(type, messages = []) {
        const envModel = process.env.LLM_MODEL;
        if (envModel) return envModel;

        const provider = this.settingsCache.provider;

        // Use small model for Logic/Planner tasks to avoid Rate Limits (429)
        if (type === 'logic') {
            return provider === 'groq' ? "llama-3.1-8b-instant" : (constants.AI_LOGIC_MODEL || "llama-3.1-8b-instant");
        }

        // AUTO-DETECT VISION NEED
        const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
        if (hasImage && provider === 'groq') {
            return constants.AI_VISION_MODEL || "llama-3.2-11b-vision-preview";
        }

        // Use large model for high-quality Personality/Chat
        if (provider === 'groq') return "llama-3.3-70b-versatile";
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
            .filter(m => m && typeof m === 'object' && ['system', 'user', 'assistant', 'tool'].includes(m.role))
            .map(m => {
                const sanitized = { role: m.role };

                if (m.role === 'tool') {
                    sanitized.content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || {});
                    sanitized.tool_call_id = m.tool_call_id;
                    sanitized.name = m.name;
                } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
                    sanitized.content = ""; // Use empty string instead of null for Groq compatibility
                    sanitized.tool_calls = m.tool_calls;
                } else {
                    // Support for Multi-modal Array content (OpenAI/Groq Vision)
                    if (Array.isArray(m.content)) {
                        sanitized.content = m.content;
                    } else {
                        sanitized.content = String(m.content || "");
                    }
                }

                return sanitized;
            });
    }

    static _logAIEvent(type, payload, response, duration, usage = null, url = '') {
        console.log('\n================== AI DEBUG LOG START ==================');
        console.log(`Type     : ${type}`);
        console.log(`Model    : ${payload.model}`);
        console.log(`Duration : ${duration}ms`);
        if (url) console.log(`URL      : ${url}`);

        console.log('\n--- DATA SENT TO AI ---');
        if (payload.messages) {
            payload.messages.forEach(m => {
                console.log(`[${m.role.toUpperCase()}]: ${m.content}`);
            });
        }

        console.log('\n--- AI RESPONSE ---');
        const respStr = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
        console.log(respStr);

        if (usage) {
            console.log('\n--- TOKEN USAGE ---');
            console.log(`Prompt Tokens     : ${usage.prompt_tokens || usage.prompt_eval_count || 0}`);
            console.log(`Completion Tokens : ${usage.completion_tokens || usage.eval_count || 0}`);
            console.log(`Total Tokens      : ${usage.total_tokens || ((usage.prompt_eval_count || 0) + (usage.eval_count || 0))}`);
        }
        console.log('================== AI DEBUG LOG END ====================\n');
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
                const sanitizedMessages = this.sanitizeMessages([{ role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON. No markdown backticks, no preamble, no thinking tags.' }, { role: 'user', content: prompt }]);
                const model = this.getModel('logic', sanitizedMessages);

                let payload = {
                    model: model,
                    messages: sanitizedMessages,
                    max_tokens: Number(process.env.LLM_MAX_TOKENS || 500),
                    temperature: 0.2, // Low for logic consistency
                    frequency_penalty: 0.3,
                    stream: false
                };

                const response = await axios.post(fullUrl, payload, {
                    timeout: 45000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                });

                const duration = Date.now() - startTime;
                let raw = "";
                if (response.data.choices && response.data.choices[0].message) {
                    raw = response.data.choices[0].message.content;
                } else if (response.data.message && response.data.message.content) {
                    raw = response.data.message.content;
                } else if (response.data.response) {
                    raw = response.data.response;
                }

                // Log detailed AI event
                this._logAIEvent('LOGIC_GEN', payload, raw, duration, response.data.usage, fullUrl);

                if (!raw) throw new Error("Empty response from LLM");

                // ADVANCED EXTRACTION: Handle stuttering at the end of JSON (e.g. "}}", "}.")
                const firstBrace = raw.indexOf('{');
                if (firstBrace === -1) throw new Error("No JSON start found");

                let bracketCount = 0;
                let lastBrace = -1;
                let inString = false;
                let escaped = false;

                for (let j = firstBrace; j < raw.length; j++) {
                    const char = raw[j];
                    if (char === '"' && !escaped) inString = !inString;

                    if (!inString) {
                        if (char === '{') bracketCount++;
                        else if (char === '}') {
                            bracketCount--;
                            if (bracketCount === 0) {
                                lastBrace = j;
                                break;
                            }
                        }
                    }
                    if (char === '\\') escaped = !escaped;
                    else escaped = false;
                }

                if (lastBrace === -1) throw new Error("Incomplete JSON structure");

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
                const sanitizedMessages = this.sanitizeMessages(messages);
                const model = this.getModel('personality', sanitizedMessages);

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
                        messages: sanitizedMessages,
                        max_tokens: optionsOverride.max_tokens || Number(process.env.LLM_MAX_TOKENS || 350),
                        temperature: optionsOverride.temperature || 0.7, // Higher for better personality
                        top_p: 0.9,
                        frequency_penalty: 0.3,
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

                // Log detailed AI event
                this._logAIEvent('CHAT_GEN', payload, content, duration, response.data.usage, fullUrl);

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
            const sanitizedMessages = this.sanitizeMessages(messages);
            const model = this.getModel('personality', sanitizedMessages);

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
                    messages: sanitizedMessages,
                    max_tokens: Number(process.env.LLM_MAX_TOKENS || 350),
                    temperature: 0.2,
                    top_p: 0.9,
                    frequency_penalty: 0.3,
                    stream: true,
                    stream_options: { include_usage: true }
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
                let fullResponse = '';
                let usage = null;

                response.data.on('data', chunk => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        let text = line.trim();
                        if (!text) continue;

                        if (text.startsWith('data: ')) text = text.slice(6).trim();
                        if (text === '[DONE]') continue;

                        try {
                            const json = JSON.parse(text);

                            // Track usage if available (OpenAI/Groq style)
                            if (json.usage) usage = json.usage;
                            // Ollama style usage
                            if (json.prompt_eval_count) usage = json;

                            const content = (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                          (json.message && json.message.content) ||
                                          json.response;
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                            }
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
                                if (json.usage) usage = json.usage;
                                if (json.prompt_eval_count) usage = json;

                                const content = (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                              (json.message && json.message.content) || json.response;
                                if (content) {
                                    fullResponse += content;
                                    onChunk(content);
                                }
                            }
                        } catch (e) {}
                    }

                    const duration = Date.now() - startTime;
                    this._logAIEvent('STREAM_GEN', payload, fullResponse, duration, usage, fullUrl);
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
