/**
 * ResponseValidator Module
 * Responsibility: Actively validates AI draft answers against policy, ground truth, and semantic intent.
 */
class ResponseValidator {
    /**
     * @param {string} response - Draft content from LLM.
     * @param {Object} context - { query, liveData, intent, userProfile, isPureGreeting, resolvedIntent, state }
     * @returns {Object} { passed, issues, severity, shouldRetryLLM }
     */
    static validate(response, { query, liveData, intent, userProfile, isPureGreeting, resolvedIntent, state }) {
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
            'system ki madad se', 'policy', 'rule', 'as per my rule', 'i must not guess',
            'classifier', 'semantic', 'resolved intent', 'embedding'
        ];

        for (const phrase of globalForbidden) {
            if (resLower.includes(phrase)) {
                issues.push(`Internal leakage: "${phrase}" found.`);
                severity = "HIGH";
            }
        }

        if (response.match(/\b(JOB_QUERY|MORE_JOBS|JOB_FEE_DETAILS|GOVERNMENT_JOBS|CAREER_GUIDANCE|EXPLAIN_LAST_FAILURE|SHOW_FULL_DETAILS|DATABASE_FIRST|PROFILE_AND_LLM)\b/)) {
            issues.push("Internal leakage: intent graph label visible to user.");
            severity = "HIGH";
        }

        // 2. SEMANTIC INTENT VALIDATION
        // If query was about jobs but response is general
        const jobLikeIntent = resolvedIntent && ['JOB_QUERY', 'MORE_RESULTS', 'MORE_JOBS', 'APPLICATION_HELP', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS'].includes(resolvedIntent.primaryIntent);
        if (jobLikeIntent) {
            const hasJobKeywords = resLower.match(/(job|vacancy|naukri|bharti|post|apply|opening)/i);
            const isDataMissing = !liveData.jobs && !liveData.web;

            if (!hasJobKeywords && !isDataMissing) {
                issues.push("Semantic mismatch: Job query was answered with general content.");
                severity = "HIGH";
            }
        }

        if ((liveData.jobs || liveData.web) && resLower.match(/(verified jankari nahi mili|koi data nahi|no data|nahi mila)/i)) {
            issues.push("Data contradiction: verified data exists but response says no data.");
            severity = "HIGH";
        }

        // 3. FOLLOW-UP VALIDATION
        // If it was a follow-up but AI treated it as a new topic
        if (resolvedIntent?.isFollowUp && state?.topic && state.topic !== 'GENERAL') {
            const mentionsTopic = resLower.includes(state.topic.toLowerCase()) ||
                                 (state.lastShownJobs && state.lastShownJobs.some(j => resLower.includes(j.toLowerCase().split(' ')[0])));

            if (!mentionsTopic && !isPureGreeting && !resLower.includes('maaf kijiye') && ['FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'SHOW_FULL_DETAILS'].includes(resolvedIntent.primaryIntent)) {
                issues.push("Context loss: Follow-up query ignored previous topic/item.");
                severity = "HIGH";
            }
        }

        // 4. FACTUAL VALIDATION
        const jobIntents = ['GOVT_JOB', 'EXAM', 'POLICE_JOB', 'RAILWAY_JOB', 'BANK_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB', 'JOB_QUERY', 'FIELD_DETAILS', 'MORE_JOBS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT'];
        if (jobIntents.includes(intent) || jobLikeIntent || resLower.includes('vacancy') || resLower.includes('last date')) {
            const combinedData = ((liveData.jobs || "") + " " + (liveData.web || "")).toLowerCase();

            // Hallucination check for numbers (Vacancy/Dates/Salaries)
            const numbers = response.match(/\d{3,}/g) || [];
            for (const num of numbers) {
                if (!combinedData.includes(num) && !query.includes(num)) {
                    issues.push(`Hallucination: Invented number "${num}" not in context.`);
                    severity = "HIGH";
                }
            }

            // Hallucination check for specific keywords if data is missing
            if (!liveData.jobs && !liveData.web) {
                if (resLower.match(/(salary is|last date is|vacancy is|eligibility is)/i)) {
                    issues.push("Hallucination: AI invented specific job details without source data.");
                    severity = "HIGH";
                }
            }
        }

        // 5. DATA SOURCE VALIDATION
        const dataBacked = ['JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'APPLICATION_HELP', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'];
        if (resolvedIntent && dataBacked.includes(resolvedIntent.primaryIntent) && !liveData.jobs && !liveData.web) {
            const containsSpecificFact = resLower.match(/(\d+\s*(post|vacanc|posts)|last date|official link|\[link\]|salary|fee\s*:|age limit)/i);
            if (containsSpecificFact) {
                issues.push("Data source mismatch: data-backed intent produced facts without verified source.");
                severity = "HIGH";
            }
        }

        // 6. GREETING VALIDATION
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
        }

        return {
            passed: issues.length === 0,
            issues: issues,
            severity: severity,
            shouldRetryLLM: severity === "HIGH"
        };
    }
}

module.exports = ResponseValidator;
