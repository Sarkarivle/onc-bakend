class SearchReranker {
    /**
     * Aggressively prioritizes official government sources.
     */
    static rank(query, results) {
        if (!results || !Array.isArray(results)) return [];

        const q = query.toLowerCase();
        const scoredResults = results.map(res => {
            let score = 0;
            const url = res.url.toLowerCase();
            const title = res.title.toLowerCase();

            // 1. Extreme Priority: Official Government Portals
            if (url.includes('.gov.in') || url.includes('.nic.in') || url.includes('.edu.in')) score += 100;
            if (url.includes('upsc.') || url.includes('ssc.') || url.includes('ibps.')) score += 80;
            if (url.includes('recruitment') || url.includes('notification')) score += 20;

            // 2. Penalize Blogs and Social Media
            if (url.includes('facebook.com') || url.includes('youtube.com') || url.includes('instagram.com')) score -= 100;
            if (url.includes('sarkari-result-naukri') || url.includes('blog')) score -= 30; // Unofficial aggregators

            // 3. Keyword Match
            const keywords = q.split(/\s+/).filter(k => k.length > 3);
            keywords.forEach(word => {
                if (title.includes(word)) score += 10;
            });

            return { ...res, score };
        });

        return scoredResults
            .filter(r => r.score > -50) // Drop low-quality junk
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }
}

module.exports = SearchReranker;
