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
        this.timeout = config.timeout || 60000;
    }

    async chat(messages, options = {}) {
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
    }

    async chatStream(messages, onChunk, options = {}) {
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
                        const parsed = JSON.parse(line.replace(/^data: /, ''));
                        const content = parsed.choices?.[0]?.delta?.content || parsed.message?.content || "";
                        if (content) {
                            fullContent += content;
                            onChunk(content);
                        }
                    } catch (e) {
                        // Sometimes chunks are partial JSON
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
    }
}

module.exports = RunpodProvider;
