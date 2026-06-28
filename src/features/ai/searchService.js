const axios = require('axios');

class SearchService {
    /**
     * Performs a Google Search when database lacks information.
     * Uses Google Custom Search JSON API.
     */
    static async search(query, apiKey, cx) {
        if (typeof query !== 'string') {
            console.warn("⚠️ [SEARCH_API] Invalid query. Skipping web search.");
            return [];
        }

        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 3) {
            console.warn("⚠️ [SEARCH_API] Query too short. Skipping web search.");
            return [];
        }

        if (!apiKey || !cx) {
            console.warn("⚠️ Google Search API Key or CX missing. Skipping web search.");
            return [];
        }

        try {
            console.log(`🌐 [SEARCH_API] Searching Google for: ${trimmedQuery}`);
            // Google Custom Search API
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                timeout: 7000,
                params: {
                    key: apiKey,
                    cx: cx,
                    q: trimmedQuery
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
            const googleError = error.response?.data?.error;
            const code = googleError?.code || error.code || 'UNKNOWN';
            const message = googleError?.message || error.message || 'Unknown Google Search API error';
            console.error("❌ [SEARCH_API] Google Search API Error:", { code, message });
        }
        return [];
    }
}

module.exports = SearchService;
