class ResponseValidator {
    /**
     * Actively validates the response against the Ground Truth and Policy.
     */
    static validate(response, { query, liveData, intent }) {
        const issues = [];
        const resLower = response.toLowerCase();

        // 1. RULE EXPOSURE CHECK (Strict)
        const forbiddenPhrases = [
            'verified source recommended',
            'backend rule',
            'system rule',
            'sarkari naukri ka niyam',
            'i must not guess',
            'as per my rule',
            'internal validation',
            'source recommended',
            'hallucination guard',
            'sourceverified',
            'validation failed',
            'official source recommended',
            'sapni wala data',
            'please respond with one of the following'
        ];

        for (const phrase of forbiddenPhrases) {
            if (resLower.includes(phrase)) {
                issues.push(`Internal rule exposure detected: ${phrase}`);
            }
        }

        // 2. GREETING POLICY CHECK
        if (intent === 'GENERAL' || intent === 'GREETING') {
            if (resLower.includes('career') || resLower.includes('government job') || resLower.includes('qualification') || resLower.includes('vacancy')) {
                 if (!query.toLowerCase().match(/(career|job|vacancy|qualification)/)) {
                     issues.push("Greeting response contains unnecessary job/career lecture");
                 }
            }
        }

        // 3. Factual Number Enforcement
        if (!['GREETING', 'THANKS', 'SMALL_TALK'].includes(intent)) {
            const numbersInResponse = response.match(/\d{3,}/g) || []; // Check numbers with 3+ digits (salaries, vacancies)
            const combinedData = (liveData.jobs + liveData.web).toLowerCase();

            for (const num of numbersInResponse) {
                if (!combinedData.includes(num)) {
                    issues.push(`Hallucination detected: AI invented a number not in source data: ${num}`);
                    break;
                }
            }
        }

        // 4. Structural Integrity
        if (!response.includes('<USER_MESSAGE>')) issues.push("Missing <USER_MESSAGE> tags");

        return {
            isValid: issues.length === 0,
            issues: issues,
            score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 20))
        };
    }
}

module.exports = ResponseValidator;
