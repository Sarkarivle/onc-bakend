const axios = require('axios');
const http = require('http');
const https = require('https');
const Settings = require('../../../settings/settingsModel');
const constants = require('../../../../config/constants');
const { llmQueue, llmCircuitBreaker, backoffDelayMs } = require('../../utils/llmResilience');

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
     * Fetches and logs available models from Groq for debugging.
     */
    static async logAvailableModels() {
        try {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) return;

            const response = await axios.get('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (response.data && response.data.data) {
                const modelIds = response.data.data.map(m => m.id);
                console.log('\n--- GROQ AVAILABLE MODELS ---');
                console.log(modelIds.join('\n'));
                console.log('------------------------------\n');
            }
        } catch (e) {
            console.error("❌ Models Logger Error:", e.message);
        }
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

        // Use small/fast model for Logic/Planner tasks to avoid Rate Limits (429)
        if (type === 'logic') {
            return constants.AI_LOGIC_MODEL || "openai/gpt-oss-20b";
        }

        // AUTO-DETECT VISION NEED
        const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
        if (hasImage) {
            return constants.AI_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
        }

        // Use large model for high-quality Personality/Chat
        return constants.AI_PERSONALITY_MODEL || "openai/gpt-oss-120b";
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
                    sanitized.content = null; // Strict OpenAI/Groq requirement
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
        // Optimized Log Summary for Production
        console.log(`[AI Event] ${type} | ${payload.model} | ${duration}ms | Tokens: ${usage?.total_tokens || '?'}`);
    }

    /**
     * ROBUST JSON LOGIC ENGINE
     */
    static async generateLogic(prompt, retries = 2) {
        const startTime = Date.now();
        this.callStats.logic++;
        this.callStats.total++;

        if (llmCircuitBreaker.isOpen()) {
            console.warn('⚠️ LLM circuit breaker open - failing fast on generateLogic (provider is unhealthy, cooling down).');
            return null;
        }

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
                // gpt-oss reasoning models can spend the entire max_tokens budget on their
                // internal "analysis" channel before ever emitting the final JSON answer,
                // which comes back as a genuinely empty message.content (not a network error,
                // so retries alone don't help — same prompt fails the same way every time).
                // These logic/rerank/classification calls are simple structured-output tasks
                // that don't need deep reasoning, so cap the reasoning budget explicitly.
                if (/^openai\/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';

                const response = await llmQueue.run(() => axios.post(fullUrl, payload, {
                    timeout: 45000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                }));
                llmCircuitBreaker.recordSuccess();

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

                // UNIVERSAL JSON EXTRACTOR (Bulletproof for Gemini Level)
                const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (!jsonMatch) {
                    console.warn("⚠️ No JSON brackets found, returning raw as logic.");
                    return { raw_response: raw };
                }

                const jsonString = jsonMatch[0];
                try {
                    return JSON.parse(jsonString);
                } catch (parseError) {
                    // Deep Cleaning: Remove common LLM artifacts
                    const cleanJson = jsonString
                        .replace(/\\n/g, "")
                        .replace(/\\r/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                    try { return JSON.parse(cleanJson); } catch (e) { throw new Error("JSON Parse Final Failure"); }
                }
            } catch (error) {
                llmCircuitBreaker.recordFailure();
                if (error.response) {
                    console.error("[LLMProvider] Logic Error status:", error.response.status);
                    console.error("[LLMProvider] Logic Error body:", JSON.stringify(error.response.data, null, 2));
                }
                console.warn(`⚠️ LLM Logic Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) return null;
                await new Promise(r => setTimeout(r, backoffDelayMs(i, error)));
            }
        }
    }

    static async chat(messages, retries = 1, optionsOverride = {}) {
        const startTime = Date.now();
        this.callStats.chat++;
        this.callStats.total++;

        if (llmCircuitBreaker.isOpen()) {
            throw new Error('LLM circuit breaker open - provider is unhealthy, cooling down.');
        }

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
                        max_tokens: optionsOverride.max_tokens || Number(process.env.LLM_MAX_TOKENS || 1500),
                        temperature: optionsOverride.temperature || 0.7, // Higher for better personality
                        top_p: 0.9,
                        frequency_penalty: 0.3,
                        stream: false
                    };
                }

                const response = await llmQueue.run(() => axios.post(fullUrl, payload, {
                    timeout: 90000,
                    headers: this.getHeaders(),
                    httpAgent,
                    httpsAgent
                }));
                llmCircuitBreaker.recordSuccess();

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
                llmCircuitBreaker.recordFailure();
                if (error.response) {
                    console.error("[LLMProvider] Chat Error status:", error.response.status);
                    console.error("[LLMProvider] Chat Error body:", JSON.stringify(error.response.data, null, 2));
                }
                console.warn(`⚠️ Personality Engine Attempt ${i + 1} failed: ${error.message}`);
                if (i === retries) throw error;
                await new Promise(r => setTimeout(r, backoffDelayMs(i, error, { baseMs: 2000 })));
            }
        }
    }

    static async chatStream(messages, onChunk, optionsOverride = {}) {
        const startTime = Date.now();
        this.callStats.stream++;
        this.callStats.total++;

        if (llmCircuitBreaker.isOpen()) {
            throw new Error('LLM circuit breaker open - provider is unhealthy, cooling down.');
        }

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
                    options: { temperature: optionsOverride.temperature || 0.7 }
                };
            } else {
                payload = {
                    model: model,
                    messages: sanitizedMessages,
                    max_tokens: optionsOverride.max_tokens || Number(process.env.LLM_MAX_TOKENS || 1500),
                    temperature: optionsOverride.temperature ?? 0.2,
                    top_p: 0.9,
                    frequency_penalty: 0.3,
                    stream: true,
                    stream_options: { include_usage: true }
                };
                // Same empty-response risk as generateLogic() for tight token budgets (e.g.
                // 'tiny'/'standard' depth's 500-1700 tokens) — cap internal reasoning so the
                // model reaches its actual answer instead of spending the whole budget on
                // hidden analysis. Leave 'deep' (larger budget, genuinely complex questions)
                // at the default reasoning effort so answer quality isn't capped there too.
                if (/^openai\/gpt-oss/i.test(model) && payload.max_tokens <= 1700) payload.reasoning_effort = 'low';
            }

            const response = await llmQueue.run(() => axios.post(fullUrl, payload, {
                responseType: 'stream',
                timeout: 90000,
                headers: this.getHeaders(),
                httpAgent,
                httpsAgent
            }));
            llmCircuitBreaker.recordSuccess();

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
                            if (json.done) resolve(fullResponse);
                        } catch (e) {}
                    }
                });

                response.data.on('error', (err) => { llmCircuitBreaker.recordFailure(); reject(err); });
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
                    resolve(fullResponse);
                });
            });
        } catch (error) {
            llmCircuitBreaker.recordFailure();
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
