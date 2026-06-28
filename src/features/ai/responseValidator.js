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

        // Greeting Isolation: Prevent Job/Career leaks in pure greeting
        if (intent === 'GREETING') {
            const greetingLeakes = ['job', 'naukri', 'vacancy', 'recruitment', 'last date', 'eligibility', 'official link', 'pro tip'];
            for (const leak of greetingLeakes) {
                if (resLower.includes(leak)) {
                    issues.push(`Greeting leakage detected: ${leak}`);
                }
            }
        }

        for (const phrase of forbiddenPhrases) {
            if (resLower.includes(phrase)) {
                issues.push(`Internal rule exposure detected: ${phrase}`);
            }
        }

        // 2. GREETING POLICY CHECK
        if (intent === 'GENERAL' || intent === 'GREETING') {
            const forbiddenInGreeting = ['government job', 'qualification', 'vacancy', 'eligibility', 'salary structure'];
            for (const phrase of forbiddenInGreeting) {
                if (resLower.includes(phrase) && !query.toLowerCase().includes(phrase)) {
                    issues.push(`Greeting response contains unnecessary info: ${phrase}`);
                    break;
                }
            }
        }

        // 3. Factual Number Enforcement
        if (!['GREETING', 'THANKS', 'SMALL_TALK', 'GENERAL'].includes(intent)) {
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
        const isConversational = ['GREETING', 'THANKS', 'SMALL_TALK', 'GENERAL'].includes(intent);
        if (!isConversational && !response.includes('<USER_MESSAGE>')) issues.push("Missing <USER_MESSAGE> tags");

        return {
            isValid: issues.length === 0,
            issues: issues,
            score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 20))
        };
    }
}

module.exports = ResponseValidator;
