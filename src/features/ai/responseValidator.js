/**
 * ResponseValidator Module
 * Responsibility: Validate the LLM response against intent, context, and formatting rules.
 */
class ResponseValidator {
    /**
     * @param {string} response - The LLM generated response.
     * @param {Object} context - { query, intent, plan, liveData }
     * @returns {Object} Validation result { isValid, issues, score }
     */
    static validate(response, { query, intent, plan, liveData }) {
        const issues = [];
        let score = 100;

        // 1. Tag Check (Essential for parsing)
        if (!response.includes('<USER_MESSAGE>')) {
            issues.push("Missing <USER_MESSAGE> tags");
            score -= 30;
        }

        // 2. Intent Alignment
        const resLower = response.toLowerCase();
        const qLower = query.toLowerCase();

        if (intent === 'GOVT_JOB' && !resLower.match(/job|vacancy|naukri|post/)) {
            issues.push("Response does not seem to address the Job query");
            score -= 20;
        }

        // 3. Completeness (Check if search was needed but results weren't utilized)
        if (plan.needSearch && liveData.web && !resLower.includes('http')) {
            // This is a heuristic: usually search results include links
            issues.push("Search was performed but links are missing in response");
            score -= 15;
        }

        // 4. Hallucination / Safety (Basic Heuristic)
        if (resLower.includes('password') || resLower.includes('otp')) {
            issues.push("Safety violation: possible sensitive data request");
            score -= 50;
        }

        // 5. Formatting Check
        if (plan.needFormatting === 'Detailed' && response.length < 100) {
            issues.push("Detailed response expected but got a short answer");
            score -= 10;
        }

        return {
            isValid: score > 70,
            issues: issues,
            score: Math.max(0, score)
        };
    }
}

module.exports = ResponseValidator;
