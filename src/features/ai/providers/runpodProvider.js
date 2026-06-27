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
}

module.exports = RunpodProvider;
