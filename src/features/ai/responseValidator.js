class ResponseValidator {
    /**
     * Actively validates the response against the Ground Truth.
     */
    static validate(response, { query, liveData, intent }) {
        const issues = [];
        const resLower = response.toLowerCase();

        // Skip strict factual check for simple conversations
        if (intent && ['GREETING', 'THANKS', 'SMALL_TALK'].includes(intent)) {
            return { isValid: true, issues: [], score: 100 };
        }

        // 1. Check for hallucinated numbers/dates
        const numbersInResponse = response.match(/\d+/g) || [];
        const combinedData = (liveData.jobs + liveData.web).toLowerCase();

        // If a number appears in the response but not in the liveData, it's a risk (unless it's a common greeting/filler)
        numbersInResponse.forEach(num => {
            if (num.length > 2 && !combinedData.includes(num)) {
                // Potential hallucination of dates/salaries/vacancies
                issues.push(`Unverified number detected: ${num}`);
            }
        });

        // 2. Check for "guessed" official websites
        if (resLower.includes('.gov.in') || resLower.includes('.nic.in')) {
            const urls = response.match(/[a-zA-Z0-9.-]+\.(gov|nic)\.in/g) || [];
            urls.forEach(url => {
                if (!combinedData.includes(url.toLowerCase())) {
                    issues.push(`Unverified government URL: ${url}`);
                }
            });
        }

        // 3. Structural Integrity
        if (!response.includes('<USER_MESSAGE>')) issues.push("Missing <USER_MESSAGE> tags");

        return {
            isValid: issues.length === 0,
            issues: issues,
            score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 20))
        };
    }
}

module.exports = ResponseValidator;
