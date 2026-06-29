const axios = require('axios');
const LLMProvider = require('./llmProvider');

/**
 * Runpod / OpenAI-compatible API Adapter
 */
class RunpodProvider extends LLMProvider {
    constructor(config) {
        super();
        this.baseUrl = config.baseUrl;
        this.model = config.model;
        this.timeout = config.timeout || 120000; // Increased to 120s for 70B
    }

    async chat(messages, options = {}) {
        try {
            const response = await axios.post(this.baseUrl, {
                model: this.model,
                messages: messages,
                stream: false,
                options: { temperature: options.temperature || 0.5 }
            }, { timeout: this.timeout });

            if (!response.data || !response.data.message) {
                throw new Error("Invalid response from RunpodProvider");
            }

            return {
                content: response.data.message.content,
                raw: response.data,
                provider: 'runpod'
            };
        } catch (error) {
            console.error("❌ Runpod/Ollama Chat Error:", error.response?.data || error.message);
            throw error;
        }
    }

    async chatStream(messages, onChunk, options = {}) {
        try {
            const response = await axios.post(this.baseUrl, {
                model: this.model,
                messages: messages,
                stream: true,
                options: { temperature: options.temperature || 0.5 }
            }, {
                timeout: this.timeout,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let fullContent = "";
                response.data.on('data', chunk => {
                    const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                    for (const line of lines) {
                        if (line.includes('[DONE]')) continue;
                        try {
                            const raw = line.replace(/^data: /, '');
                            if (raw.trim() === '') continue;
                            const parsed = JSON.parse(raw);
                            const content = parsed.choices?.[0]?.delta?.content || parsed.message?.content || "";
                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Partial JSON skip
                        }
                    }
                });

                response.data.on('end', () => {
                    resolve({
                        content: fullContent,
                        provider: 'runpod'
                    });
                });

                response.data.on('error', reject);
            });
        } catch (error) {
            console.error("❌ Runpod/Ollama Stream Error:", error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = RunpodProvider;
