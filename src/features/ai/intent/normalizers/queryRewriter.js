/**
 * QueryRewriter Module
 * Responsibility: Rewrites ambiguous queries into complete questions.
 */
class QueryRewriter {
    static rewrite(query, state = {}) {
        const q = String(query || '').toLowerCase().trim();
        const currentTopic = state.currentTopic || state.topic || "";

        const shorthands = {
            'ssc': 'Tell me about SSC (Staff Selection Commission) examinations in India.',
            'upsc': 'Tell me about UPSC (Union Public Service Commission) examinations.',
            'railway': 'Tell me about the latest Railway job vacancies.',
            'bank': 'Tell me about Banking job exams in India.',
            'police': 'Tell me about Police department recruitment.',
            'navy': 'Tell me about Indian Navy recruitment.',
            'army': 'Tell me about Indian Army Agniveer and other posts.',
            'airforce': 'Tell me about Indian Air Force recruitment.'
        };

        if (shorthands[q]) return shorthands[q];

        if (currentTopic) {
            const topicQ = q.replace(/\?$/, '');

            const contextPatterns = [
                { pattern: /^(age|umra|umr|age limit|kitni age)$/, rewrite: `What is the age limit for ${currentTopic}?` },
                { pattern: /^(salary|paisa|vetan|monthly income|pay scale)$/, rewrite: `What is the salary structure of ${currentTopic}?` },
                { pattern: /^(eligibility|qualification|yogyata|kaun bhar sakta hai)$/, rewrite: `What is the eligibility and qualification required for ${currentTopic}?` },
                { pattern: /^(syllabus|pattern|exams|subjects|viday)$/, rewrite: `What is the exam pattern and syllabus for ${currentTopic}?` },
                { pattern: /^(selection|process|chayan|kaise hoga)$/, rewrite: `What is the selection process for ${currentTopic}?` },
                { pattern: /^(height|chest|physical|running)$/, rewrite: `What are the physical standards (height, chest, running) for ${currentTopic}?` },
                { pattern: /^(books|kitab|best book|resources)$/, rewrite: `Which are the best books and preparation resources for ${currentTopic}?` }
            ];

            for (const item of contextPatterns) {
                if (topicQ.match(item.pattern)) {
                    return item.rewrite;
                }
            }
        }

        return query;
    }
}

module.exports = QueryRewriter;
