const axios = require('axios');

class SearchService {
    /**
     * Performs a web search when database lacks information.
     * Uses Brave Search or SerpApi as a backbone.
     */
    static async search(query, apiKey) {
        if (!apiKey) {
            console.warn("⚠️ Web Search Key missing. Skipping web search.");
            return null;
        }

        try {
            // Using Brave Search API as an example (Very efficient for AI)
            const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
                params: { q: query },
                headers: { 'X-Subscription-Token': apiKey }
            });

            if (response.data && response.data.web && response.data.web.results) {
                return response.data.web.results.slice(0, 3).map(r => ({
                    title: r.title,
                    description: r.description,
                    url: r.url
                }));
            }
        } catch (error) {
            console.error("❌ Search API Error:", error.message);
        }
        return null;
    }
}

module.exports = SearchService;
