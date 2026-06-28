/**
 * ResponseValidator Module
 * Responsibility: Actively validates AI draft answers against policy, ground truth, and safety.
 */
class ResponseValidator {
    /**
     * @param {string} response - Draft content from LLM.
     * @param {Object} context - { query, liveData, intent, userProfile, isPureGreeting }
     * @returns {Object} { passed, issues, severity, shouldRetryLLM }
     */
    static validate(response, { query, liveData, intent, userProfile, isPureGreeting }) {
        const issues = [];
        const resLower = response.toLowerCase();
        let severity = "LOW";

        // 1. GLOBAL FORBIDDEN PHRASES (Backend Leakage)
        const globalForbidden = [
            'backend rule', 'system rule', 'planner', 'intent detected',
            'confidence score', 'search router', 'database miss', 'internal database',
            'hallucination guard', 'sourceverified', 'validation failed',
            'verified source recommended', 'pure greeting', 'greeting detected',
            'aapne sirf', 'sirf hi bola', 'isliye maine', 'maine system ki madad se',
            'system ki madad se', 'policy', 'rule', 'as per my rule', 'i must not guess'
        ];

        for (const phrase of globalForbidden) {
            if (resLower.includes(phrase)) {
                issues.push(`Internal leakage: "${phrase}" found.`);
                severity = "HIGH";
            }
        }

        // 2. GREETING VALIDATION
        if (isPureGreeting || intent === 'GREETING') {
            const greetingLeaks = [
                'job', 'naukri', 'vacancy', 'recruitment', 'last date', 'eligibility',
                'salary', 'official link', 'career', 'pro tip', 'latest update',
                'application', 'exam'
            ];

            for (const leak of greetingLeaks) {
                if (resLower.includes(leak) && !query.toLowerCase().includes(leak)) {
                    issues.push(`Greeting contains irrelevant job content: "${leak}"`);
                    severity = "MEDIUM";
                }
            }

            if (resLower.includes("main jobo ai hu") && !query.toLowerCase().match(/(kaun|who)/)) {
                issues.push("Repeated AI identity in greeting.");
            }
        }

        // 3. JOB FACT VALIDATION (Strict)
        const jobIntents = ['GOVT_JOB', 'EXAM', 'POLICE_JOB', 'RAILWAY_JOB', 'BANK_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'];
        if (jobIntents.includes(intent) || resLower.includes('vacancy') || resLower.includes('last date')) {
            const combinedData = ((liveData.jobs || "") + " " + (liveData.web || "")).toLowerCase();

            // Hallucination check for numbers (Vacancy/Dates/Salaries)
            const numbers = response.match(/\d{3,}/g) || [];
            for (const num of numbers) {
                if (!combinedData.includes(num)) {
                    issues.push(`Hallucination: Invented number "${num}" not in context.`);
                    severity = "HIGH";
                }
            }

            // Hallucination check for specific keywords if database is empty
            if (!liveData.jobs && !liveData.web) {
                const specificKeywords = ['upsssc', 'rrb', 'ssc', 'upsc', 'bpsc'];
                for (const kw of specificKeywords) {
                    if (resLower.includes(kw) && !query.toLowerCase().includes(kw)) {
                        issues.push(`Hallucination: Mentioned organization "${kw}" without source data.`);
                        severity = "HIGH";
                    }
                }
            }
        }

        // 4. EXPIRED JOB CHECK
        if (response.includes('Last Date:')) {
            const dateMatches = response.match(/Last Date:\s*\*\*(.*?)\*\*/gi);
            if (dateMatches) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Simple date parser for Indian formats like "17 July 2026", "17-07-2026"
                dateMatches.forEach(match => {
                    const dateStr = match.replace(/Last Date:\s*\*\*/i, '').replace(/\*\*/, '').trim();
                    const jobDate = new Date(dateStr);
                    if (!isNaN(jobDate.getTime()) && jobDate < today) {
                        issues.push(`Expired job detected: "${dateStr}" is in the past.`);
                        severity = "HIGH";
                    }
                });
            }
        }

        // 5. IDENTITY REPETITION
        const identityCheck = (response.match(/main jobo ai hu|main onc ai assistant hoon|main aapka career assistant hu/gi) || []);
        if (identityCheck.length > 0 && !query.toLowerCase().match(/(kaun|who|tum)/)) {
            issues.push("Unnecessary AI identity self-introduction.");
            if (identityCheck.length > 1) severity = "MEDIUM";
        }

        return {
            passed: issues.length === 0,
            issues: issues,
            severity: severity,
            repairedText: "", // Filled by cleaner if needed
            shouldRetryLLM: severity === "HIGH"
        };
    }
}

module.exports = ResponseValidator;
