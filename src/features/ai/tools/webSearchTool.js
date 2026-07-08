/**
 * WebSearch Tool
 * Responsibility: Fetches live news, notifications, and current affairs from the web.
 */
const axios = require('axios');

class WebSearchTool {
    /**
     * Executes a live web search.
     * Note: In production, use SerpApi, Google Search API, or Tavily for best results.
     */
    static async search(query) {
        console.log("🌐 WebSearch: Querying for", query);
        try {
            // Using a public search API or a fallback mechanism
            // For now, we simulate the result or use a placeholder API endpoint
            const SERP_API_KEY = process.env.SERP_API_KEY;

            if (!SERP_API_KEY) {
                return {
                    success: true,
                    results: [
                        { title: "SSC Latest News", snippet: "Check official ssc.nic.in for latest notifications regarding CGL and MTS exams." },
                        { title: "Current Affairs India", snippet: "New government job openings announced in Railway and Police departments today." }
                    ],
                    note: "API Key missing. Showing general fallback results."
                };
            }

            const response = await axios.get(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&hl=hi&gl=in&api_key=${SERP_API_KEY}`);

            const results = (response.data.organic_results || []).slice(0, 3).map(r => ({
                title: r.title,
                link: r.link,
                snippet: r.snippet
            }));

            return {
                success: true,
                query: query,
                results: results
            };
        } catch (error) {
            console.error("❌ WebSearch Error:", error.message);
            return { success: false, error: "Live web search is currently unavailable." };
        }
    }
}

module.exports = WebSearchTool;
