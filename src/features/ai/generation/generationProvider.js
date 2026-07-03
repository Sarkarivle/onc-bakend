const axios = require('axios');
const Settings = require('../../settings/settingsModel');
const constants = require('../../../config/constants');

class GenerationProvider {
    static #runpodUrl = null;

    /**
     * Gets the configured RunPod URL from settings or constants, caching it for performance.
     * It intelligently handles different URL formats (base vs. full endpoint).
     */
    static async getUrl() {
        if (this.#runpodUrl) return this.#runpodUrl;

        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let url = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

        if (url && !url.includes('/api/')) {
            // If it's a base URL, append the most common endpoint.
            // This is a safe assumption for now and centralizes the logic.
            url = url.replace(/\/$/, '') + '/api/generate';
        }

        this.#runpodUrl = url;
        return this.#runpodUrl;
    }

    /**
     * Makes a request to the configured generation endpoint.
     */
    static async generate(prompt, options = {}) {
        const url = await this.getUrl();
        const response = await axios.post(url, {
            model: constants.AI_MODEL_NAME,
            prompt: `System: Return ONLY a valid JSON object. No conversation. No preamble.\n\nUser: ${prompt}`,
            ...options
        });
        return response.data;
    }
}

module.exports = GenerationProvider;