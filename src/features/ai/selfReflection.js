class SelfReflection {
    /**
     * Internally reviews the LLM response before finalizing.
     * Matches Phase 4 Pipeline: Self Reflection.
     *
     * @param {string} response - The generated response from the LLM.
     * @param {string} query - The user's query.
     */
    static reflect(response, query) {
        const res = response.toLowerCase();
        const q = query.toLowerCase();

        const feedback = {
            isHelpful: true,
            isRepetitive: false,
            hasTags: response.includes('<USER_MESSAGE>'),
            score: 1.0,
            suggestions: []
        };

        // 1. Intent Alignment Check
        if (q.includes('salary') && !res.match(/\d+|paisa|rupaye|pay/)) {
            feedback.isHelpful = false;
            feedback.score -= 0.4;
            feedback.suggestions.push("Include salary details if available.");
        }

        // 2. Structural Check
        if (!feedback.hasTags) {
            feedback.score -= 0.2;
            feedback.suggestions.push("Ensure <USER_MESSAGE> tags are present.");
        }

        // 3. Repetition Check
        const words = res.split(/\s+/);
        if (words.length > 40) {
            const uniqueRatio = new Set(words).size / words.length;
            if (uniqueRatio < 0.45) {
                feedback.isRepetitive = true;
                feedback.score -= 0.3;
                feedback.suggestions.push("Reduce redundant phrasing.");
            }
        }

        return feedback;
    }
}

module.exports = SelfReflection;
