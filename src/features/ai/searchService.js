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
            console.log(`🌐 [SEARCH_API] Searching Google for: ${query}`);
            // Google Custom Search API
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: apiKey,
                    cx: cx,
                    q: query
                }
            });

            if (response.data && response.data.items) {
                console.log(`✅ [SEARCH_API] Found ${response.data.items.length} results`);
                return response.data.items.slice(0, 5).map(r => ({
                    title: r.title,
                    description: r.snippet,
                    url: r.link
                }));
            } else {
                console.warn("⚠️ [SEARCH_API] No results found from Google.");
            }
        } catch (error) {
            console.error("❌ [SEARCH_API] Google Search API Error:", error.response?.data?.error?.message || error.message);
        }
        return null;
    }
}

module.exports = SearchService;
