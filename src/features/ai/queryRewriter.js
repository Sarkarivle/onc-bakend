const FollowUpResolver = require('./followUpResolver');

/**
 * QueryRewriter Module
 * Responsibility: Expand short or ambiguous queries into full semantic questions.
 */
class QueryRewriter {
    /**
     * @param {string} query - Raw input.
     * @param {Object} state - ConversationState.
     */
    static rewrite(query, state = {}) {
        const q = query.toLowerCase().trim();

        // 1. Resolve follow-up (Reference Resolution)
        const resolved = FollowUpResolver.resolve(query, state);
        if (resolved.isFollowUp) {
            return resolved.resolvedQuery;
        }

        // 2. Static Shorthands
        const shorthands = {
            'ssc': 'SSC Staff Selection Commission recruitment and exam details',
            'upsc': 'UPSC Union Public Service Commission civil services exams',
            'railway': 'Latest Railway recruitment RRB RPF vacancies',
            'bank': 'Banking jobs IBPS SBI clerk PO exams',
            'police': 'Police department recruitment constable SI bharti'
        };

        if (shorthands[q]) return shorthands[q];

        // 3. Fallback to original
        return query;
    }
}

module.exports = QueryRewriter;
