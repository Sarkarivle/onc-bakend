/**
 * SearchReranker Module
 * Responsibility: Rank and filter raw search results for maximum LLM context quality.
 */
class SearchReranker {
    /**
     * @param {string} query - The user's query.
     * @param {Array} results - Raw results from Google Search.
     * @returns {Array} Top 3 reranked results.
     */
    static rank(query, results) {
        if (!results || !Array.isArray(results)) return [];

        const q = query.toLowerCase();
        const currentYear = "2024";

        const scoredResults = results.map(res => {
            let score = 0;
            const title = res.title.toLowerCase();
            const snippet = res.description.toLowerCase();
            const url = res.url.toLowerCase();

            // 1. Recency Bonus (Extremely important for Gov Jobs)
            if (title.includes(currentYear) || snippet.includes(currentYear)) score += 50;

            // 2. Official Source Bonus
            if (url.includes('.gov.in') || url.includes('.nic.in') || url.includes('upsc.gov') || url.includes('ssc.nic')) {
                score += 40;
            }

            // 3. Keyword Match Density
            const keywords = q.split(/\s+/).filter(k => k.length > 3);
            keywords.forEach(word => {
                if (title.includes(word)) score += 10;
                if (snippet.includes(word)) score += 5;
            });

            // 4. Content Quality Penalty
            if (title.includes('youtube') || title.includes('facebook')) score -= 20;

            return { ...res, score };
        });

        // Sort by score descending and return top 3
        return scoredResults
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(r => ({
                title: r.title,
                snippet: r.description,
                url: r.url,
                isOfficial: r.url.includes('.in')
            }));
    }
}

module.exports = SearchReranker;
