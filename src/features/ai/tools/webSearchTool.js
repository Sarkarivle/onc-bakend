/**
 * WebSearch Tool (Architectural Version 2.0 - Persistent Researcher)
 * Responsibility: Multi-source live search with automatic fallbacks for Point 21.
 */
const axios = require('axios');
const cheerio = require('cheerio');
const Grounding = require('../quality/grounding');

class WebSearchTool {
    static async search(query) {
        console.log(`🌐 WebSearch: Querying "${query}"...`);

        // 1. Try SearchApi.io (High Quality Google Results)
        if (process.env.SEARCH_API_KEY) {
            try {
                const response = await axios.get('https://www.searchapi.io/api/v1/search', {
                    params: { engine: 'google', q: query, api_key: process.env.SEARCH_API_KEY },
                    timeout: 5000
                });

                const results = (response.data.organic_results || []).slice(0, 5).map(r => ({
                    title: r.title,
                    link: r.link,
                    snippet: r.snippet,
                    date: r.date || "Live"
                }));

                if (results.length > 0) return {
                    success: true,
                    results,
                    source: "Google via SearchApi",
                    evidence: results.map(result => Grounding.fromSearchResult(result, "Google via SearchApi"))
                };
            } catch (e) {
                console.warn("⚠️ SearchApi failed, trying fallback...");
            }
        }

        // 2. Try SerpApi (Secondary High Quality)
        if (process.env.SERP_API_KEY) {
            try {
                const response = await axios.get('https://serpapi.com/search', {
                    params: { q: query, api_key: process.env.SERP_API_KEY, hl: 'hi', gl: 'in' },
                    timeout: 5000
                });

                const results = (response.data.organic_results || []).slice(0, 5).map(r => ({
                    title: r.title,
                    link: r.link,
                    snippet: r.snippet,
                    date: r.date || "Recent"
                }));

                if (results.length > 0) return {
                    success: true,
                    results,
                    source: "Google via SerpApi",
                    evidence: results.map(result => Grounding.fromSearchResult(result, "Google via SerpApi"))
                };
            } catch (e) {
                console.warn("⚠️ SerpApi failed, trying free fallback...");
            }
        }

        // 3. FREE FALLBACK: DuckDuckGo Scraper (Point 21: Never give up)
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' },
                timeout: 5000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, el) => {
                if (i >= 5) return;
                const title = $(el).find('.result__title').text().trim();
                const link = $(el).find('.result__url').text().trim();
                const snippet = $(el).find('.result__snippet').text().trim();
                if (title && snippet) {
                    results.push({ title, link: `https://${link}`, snippet });
                }
            });

            if (results.length > 0) return {
                success: true,
                results,
                source: "DuckDuckGo (Free)",
                evidence: results.map(result => Grounding.fromSearchResult(result, "DuckDuckGo (Free)"))
            };
        } catch (error) {
            console.error("❌ WebSearch Scraper Error:", error.message);
        }

        return {
            success: false,
            error: "Bhai, internet par iska turant jawab nahi mila. Main thode alag query se try kar raha hoon.",
            code: "EMPTY_RESULT",
            evidence: []
        };
    }
}

module.exports = WebSearchTool;
