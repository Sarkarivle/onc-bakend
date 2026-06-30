/**
 * SearchService Module
 * Responsibility: Performs external web search via Google Custom Search API.
 */
const axios = require('axios');

class SearchService {
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
            const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
                timeout: 7000,
                params: {
                    key: apiKey,
                    cx: cx,
                    q: trimmedQuery
                }
            });

            if (response.data && response.data.items) {
                return response.data.items.slice(0, 5).map(r => ({
                    title: r.title,
                    snippet: r.snippet, // Renamed description to snippet to match reranker expectations
                    url: r.link
                }));
            }
        } catch (error) {
            console.error("❌ [SEARCH_API] Google Search API Error:", error.message);
        }
        return [];
    }
}

module.exports = SearchService;
