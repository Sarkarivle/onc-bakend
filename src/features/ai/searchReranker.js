/**
 * SearchReranker Module (Enterprise Logic)
 */
class SearchReranker {
    /**
     * @param {string} query - The user's query.
     * @param {Array} results - Raw results from Google Search.
     * @returns {Array} Top 3 reranked results.
     */
    static rank(query, results) {
        if (!results || !Array.isArray(results)) return [];

        const q = typeof query === 'string' ? query.toLowerCase() : '';
        // Dynamic Current Year
        const currentYear = new Date().getFullYear().toString();

        const scoredResults = results.map(res => {
            let score = 0;
            const title = (res.title || '').toLowerCase();
            const snippet = (res.description || res.snippet || '').toLowerCase();
            const url = (res.url || '').toLowerCase();

            // 1. Recency Bonus (Dynamic Year)
            if (title.includes(currentYear) || snippet.includes(currentYear)) score += 50;

            // 2. Official Source Bonus
            if (url.includes('.gov.in') || url.includes('.nic.in') || url.includes('.edu.in')) score += 40;

            // 3. Keyword Match Density
            const keywords = q.split(/\s+/).filter(k => k.length > 3);
            keywords.forEach(word => {
                if (title.includes(word)) score += 10;
                if (snippet.includes(word)) score += 5;
            });

            // 4. Content Quality Penalty
            if (title.includes('youtube') || title.includes('facebook') || title.includes('instagram')) score -= 50;

            return { ...res, score };
        });

        return scoredResults
            .filter(r => r.score > -20)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(r => ({
                title: r.title,
                description: r.description || r.snippet || "",
                snippet: r.description || r.snippet || "",
                url: r.url
            }));
    }
}

module.exports = SearchReranker;
