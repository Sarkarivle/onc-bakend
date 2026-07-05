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

    static async getBaseUrl() {
        const now = Date.now();
        if (this.settingsCache.baseUrl && this.settingsCache.expiresAt > now) {
            return this.settingsCache.baseUrl;
        }

        const setting = Settings.db?.readyState === 1
            ? await Settings.findOne({ key: 'RUNPOD_URL' })
            : null;
        let url = (setting?.value || constants.DEFAULT_RUNPOD_URL).trim();

        if (!url) {
            this.settingsCache = { baseUrl: constants.DEFAULT_RUNPOD_URL, expiresAt: now + this.SETTINGS_TTL_MS };
            return constants.DEFAULT_RUNPOD_URL;
        }

        // ULTRA-ROBUST CLEANING: Handle curl commands, quotes, and common copy-paste errors
        if (url.includes('http')) {
            // Extract just the URL if it's inside a curl command or has extra text
            const match = url.match(/https?:\/\/[^\s'"]+/);
            if (match) url = match[0];
        }

        url = url.trim().replace(/['"]/g, ''); // Remove quotes

        // Fix protocol issues
        url = url.replace(/^(https?:\/\/)+/i, (m) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
        if (!url.startsWith('http')) url = `https://${url}`;

        // Remove trailing slashes for consistency
        url = url.replace(/\/+$/, '');

        // STRIP WRONG ENDPOINTS: If user pasted /api/tags, /api/generate, /v1/models, etc.
        url = url.replace(/\/api\/(tags|generate|push|pull|show|copy|delete)\/?$/i, '');
        url = url.replace(/\/v1\/(models|chat|completions)\/?$/i, '');
        url = url.replace(/\/api\/?$/i, ''); // Avoid double /api/api
        url = url.replace(/\/+$/, ''); // Clean again

        // If the URL includes /v1, it's likely an OpenAI-compatible endpoint
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('/v1')) {
            const baseUrl = url.endsWith('/v1') ? `${url}/chat/completions` : url;
            this.settingsCache = { baseUrl, expiresAt: now + this.SETTINGS_TTL_MS };
            return baseUrl;
        }

        // If it includes /api/chat, use it as is (Ollama)
        if (lowerUrl.includes('/api/chat')) {
            this.settingsCache = { baseUrl: url, expiresAt: now + this.SETTINGS_TTL_MS };
            return url;
        }

        // Otherwise, assume it's just a domain and add default Ollama path
        const baseUrl = `${url}/api/chat`;
        this.settingsCache = { baseUrl, expiresAt: now + this.SETTINGS_TTL_MS };
        console.log(`[LLMProvider] Using URL: ${baseUrl}`);
        return baseUrl;
    }

    /**
     * ROBUST JSON LOGIC ENGINE (Handles multiple API standards)
     */
    static async generateLogic(prompt, retries = 2) {
        this.callStats.logic++;
        this.callStats.total++;
        for (let i = 0; i <= retries; i++) {
            try {
                const fullUrl = await this.getBaseUrl();
                console.log(`[LLMProvider] Calling Logic Model: ${constants.AI_LOGIC_MODEL} at ${fullUrl}`);
                const payload = {
                    model: constants.AI_LOGIC_MODEL,
                    messages: [
                        { role: 'system', content: 'You are a Strict JSON Expert. Output ONLY valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    stream: false,
                    temperature: 0.1,
                    options: { temperature: 0.1 } // Keep for Ollama
                };

                const response = await axios.post(fullUrl, payload, {
                    timeout: 45000,
                    httpAgent,
                    httpsAgent
                });

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
                const jsonMatch = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

                if (!jsonMatch) {
                    // Fallback: If it's not JSON but we're in a logic task, try to see if it's just raw text that should be JSON
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
                // Wait before retry
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
                console.log(`[LLMProvider] Calling Personality Model: ${constants.AI_PERSONALITY_MODEL} at ${fullUrl}`);
                const payload = {
                    model: constants.AI_PERSONALITY_MODEL,
                    messages: messages,
                    stream: false,
                    temperature: 0.7,
                    options: { temperature: 0.7 } // Keep for Ollama
                };

                const response = await axios.post(fullUrl, payload, {
                    timeout: 90000, // Increased for heavy models like 14B
                    httpAgent,
                    httpsAgent
                });

                let content = "";
                if (response.data.message && response.data.message.content) {
                    content = response.data.message.content;
                } else if (response.data.choices && response.data.choices[0].message) {
                    content = response.data.choices[0].message.content;
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
        let fullUrl = "";
        try {
            fullUrl = await this.getBaseUrl();
            console.log(`📡 Starting Stream: ${fullUrl} with model ${constants.AI_PERSONALITY_MODEL}`);

            const response = await axios.post(fullUrl, {
                model: constants.AI_PERSONALITY_MODEL,
                messages: messages,
                stream: true,
                options: { temperature: 0.7 }
            }, {
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

                        // Handle OpenAI-style "data: " prefix
                        if (text.startsWith('data: ')) {
                            text = text.slice(6).trim();
                        }
                        if (text === '[DONE]') {
                            resolve();
                            continue;
                        }

                        try {
                            const json = JSON.parse(text);
                            const content = (json.message && json.message.content) ||
                                          (json.choices && json.choices[0].delta && json.choices[0].delta.content) ||
                                          json.response;
                            if (content) {
                                onChunk(content);
                            }
                            if (json.done) {
                                console.log(`✅ Stream Finished. Chunks: ${chunkCount}`);
                                resolve();
                            }
                        } catch (e) {
                            // Partial JSON or non-JSON line
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
                            const json = JSON.parse(buffer);
                            const content = (json.message && json.message.content) || json.response;
                            if (content) onChunk(content);
                        } catch (e) {}
                    }
                    resolve();
                });
            });
        } catch (error) {
            console.error(`❌ LLM Stream Connection Error (${fullUrl}):`, error.message);
            if (error.response) {
                console.error("❌ Server Response Data:", error.response.data);
                console.error("❌ Server Status:", error.response.status);
            }
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
