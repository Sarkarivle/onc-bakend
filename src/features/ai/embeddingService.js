const axios = require('axios');
const Settings = require('../settings/settingsModel');

class EmbeddingService {
    /**
     * Generates a vector embedding for the given text using Gemini API.
     * @param {string} text - The text to embed.
     * @returns {Promise<Array<number>>} The vector embedding.
     */
    static async generate(text) {
        try {
            const apiKeySetting = await Settings.findOne({ key: 'GEMINI_API_KEY' });
            const apiKey = apiKeySetting?.value || process.env.GEMINI_API_KEY;

            if (!apiKey) {
                console.error("❌ GEMINI_API_KEY not found in Settings or Env");
                return null;
            }

            // Using Gemini's embedding-001 model (More stable across regions/accounts)
            const url = `https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent?key=${apiKey}`;

            const response = await axios.post(url, {
                model: "models/embedding-001",
                content: {
                    parts: [{ text: text }]
                }
            });

            return response.data.embedding.values;
        } catch (error) {
            console.error("❌ Embedding Generation Error:", error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Creates a searchable string from job data for embedding.
     */
    static createJobText(job) {
        return `Job Title: ${job.title}. Organization: ${job.organization}. Category: ${job.category}. Education: ${job.eligibility?.education}. Details: ${job.fullHtmlContent ? job.fullHtmlContent.substring(0, 500) : ''}`;
    }
}

module.exports = EmbeddingService;
