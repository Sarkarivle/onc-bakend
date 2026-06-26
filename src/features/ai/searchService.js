const axios = require('axios');

class SearchService {
    /**
     * Performs a Google Search when database lacks information.
     * Uses Google Custom Search JSON API.
     */
    static async search(query, apiKey, cx) {
        if (!apiKey || !cx) {
            console.warn("⚠️ Google Search API Key or CX missing. Skipping web search.");
            return null;
        }

        try {
            // Google Custom Search API
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: apiKey,
                    cx: cx,
                    q: query
                }
            });

            if (response.data && response.data.items) {
                return response.data.items.slice(0, 3).map(r => ({
                    title: r.title,
                    description: r.snippet,
                    url: r.link
                }));
            }
        } catch (error) {
            console.error("❌ Google Search API Error:", error.response?.data?.error?.message || error.message);
        }
        return null;
    }
}

module.exports = SearchService;
