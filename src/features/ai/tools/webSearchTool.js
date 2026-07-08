/**
 * WebSearch Tool
 * Responsibility: Fetches live news, notifications, and current affairs from the web.
 * Upgraded: Includes a FREE fallback using DuckDuckGo scraping.
 */
const axios = require('axios');
const cheerio = require('cheerio');

class WebSearchTool {
    static async search(query) {
        console.log("🌐 WebSearch: Querying for", query);

        // 1. Try SerpApi if key is available
        const SERP_API_KEY = process.env.SERP_API_KEY;
        if (SERP_API_KEY) {
            try {
                const response = await axios.get(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&hl=hi&gl=in&api_key=${SERP_API_KEY}`);
                const results = (response.data.organic_results || []).slice(0, 3).map(r => ({
                    title: r.title,
                    link: r.link,
                    snippet: r.snippet
                }));
                return { success: true, results };
            } catch (e) {
                console.warn("⚠️ SerpApi failed, falling back to free search.");
            }
        }

        // 2. FREE FALLBACK: DuckDuckGo Lite Scraping
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, el) => {
                if (i >= 3) return;
                const title = $(el).find('.result__title').text().trim();
                const link = $(el).find('.result__url').text().trim();
                const snippet = $(el).find('.result__snippet').text().trim();
                if (title && snippet) {
                    results.push({ title, link, snippet });
                }
            });

            if (results.length > 0) {
                return { success: true, results, source: "Free Web Search" };
            }

            throw new Error("No results found in free search");
        } catch (error) {
            console.error("❌ WebSearch Error:", error.message);
            return {
                success: false,
                error: "Bhai, abhi live internet search kaam nahi kar rahi. Thodi der baad try karein ya specific topic batayein."
            };
        }
    }
}

module.exports = WebSearchTool;
