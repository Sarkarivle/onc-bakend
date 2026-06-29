/**
 * ResponseValidator Module
 * Responsibility: Actively validates AI draft answers against policy, ground truth, and semantic intent.
 */
class ResponseValidator {
    /**
     * @param {string} response - Draft content from LLM.
     * @param {Obje ct} context - { query, liveData, intent, userProfile, isPureGreeting, resolvedIntent, state, plan }
     * @returns {Object} { passed, issues, severity, shouldRetryLLM }
     */
    static validate(response, { query, liveData, intent, userProfile, isPureGreeting, resolvedIntent, state, plan }) {
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

        if (response.match(/\b(JOB_QUERY|MORE_JOBS|JOB_FEE_DETAILS|GOVERNMENT_JOBS|RAILWAY_JOB|BANK_JOB|POLICE_JOB|DEFENCE_JOB|TEACHING_JOB|HEALTH_JOB|CAREER_GUIDANCE|EXPLAIN_LAST_FAILURE|SHOW_FULL_DETAILS|DATABASE_FIRST|PROFILE_AND_LLM)\b/)) {
            issues.push("Internal leakage: intent graph label visible to user.");
            severity = "HIGH";
        }

        // 2. HYPER-PERSONALIZATION & ELIGIBILITY CHECK (Gemini-like Focus)
        if (userProfile?.qualification && resLower.includes('job')) {
            const qual = userProfile.qualification.toLowerCase();
            // If user is 10th/12th pass but response shows 'Graduate' or 'Degree' jobs specifically
            if ((qual.includes('10th') || qual.includes('12th')) && !qual.includes('graduate')) {
                if (resLower.includes('graduate required') || resLower.includes('degree mandatory')) {
                    issues.push("Personalization Error: Suggested a Graduate job to a 10th/12th pass user.");
                    severity = "HIGH";
                }
            }
        }

        // 3. ZERO PRE-AMBLE CHECK (Direct Start)
        const preAmblePatterns = [
            "aapke liye ye rahi", "main samajh sakta", "ye rahi jankari",
            "is naukri ke bare mein", "naukri ki list", "here is the information"
        ];
        for (const pattern of preAmblePatterns) {
            if (resLower.startsWith(pattern) || (resLower.split('\n')[0].includes(pattern))) {
                issues.push(`Style Error: Pre-amble found ("${pattern}"). Gemini style must be direct.`);
                severity = "MEDIUM";
            }
        }

        // 4. HALLUCINATION GUARD (Jobs)
        const jobModes = ['JOB_SEARCH', 'JOB_DETAILS', 'MORE_RESULTS', 'RESULT'];
        if (jobModes.includes(plan?.mode)) {
            const hasData = (liveData.jobs && liveData.jobs.length > 0) || (liveData.web && liveData.web.length > 0);

            if (!hasData) {
                // If no data, response should NOT have specific facts
                if (resLower.match(/(\d+\s*posts|vacancy|last date|salary|₹|link)/i)) {
                    issues.push("Hallucination: Invented job facts without verified source.");
                    severity = "HIGH";
                }

                if (!resLower.match(/(maaf kijiye|verified jankari|not found|nahi mili)/i)) {
                    issues.push("Policy violation: Did not use factual fallback when data missing.");
                    severity = "MEDIUM";
                }
            } else {
                // If data exists, check numbers
                const combinedData = ((liveData.jobs || "") + " " + (liveData.web || "")).toLowerCase();
                const numbers = response.match(/\d{3,}/g) || [];
                for (const num of numbers) {
                    if (!combinedData.includes(num) && !query.includes(num)) {
                        issues.push(`Hallucination: Invented number "${num}" not in context.`);
                        severity = "HIGH";
                    }
                }
            }
        }

        // 4. CAREER GUIDANCE SPECIAL CHECK
        if (plan?.mode === 'CAREER_GUIDANCE') {
            if (resLower.match(/(verified jankari nahi mili|verified info not found)/i)) {
                issues.push("Semantic error: Said verified info missing for general career guidance.");
                severity = "MEDIUM";
            }

            if (query.toLowerCase().match(/(doctor|mbbs|medical)/i)) {
                if (!resLower.match(/(neet|mbbs|biology|pcb)/i)) {
                    issues.push("Incomplete guidance: Missed core requirements for doctor career.");
                    severity = "MEDIUM";
                }
            }
        }

        // 5. REFUSAL CHECK
        if (resolvedIntent?.communicationAct === 'CONFIRMATION' && resLower.match(/(illegal|harmful|cannot provide|against policy)/i)) {
            issues.push("False refusal: Refused a harmless confirmation.");
            severity = "HIGH";
        }

        // 6. NUMERIC REFERENCE CHECK
        if (plan?.selectedItemIndex && plan?.referencedItem) {
            const itemName = plan.referencedItem.toLowerCase().split(' ')[0];
            if (!resLower.includes(itemName) && !resLower.includes('item') && !resLower.includes('position')) {
                 issues.push(`Relevance error: Failed to discuss selected item "${plan.referencedItem}".`);
                 severity = "MEDIUM";
            }
        }

        // 7. DISCOURSE CONSISTENCY CHALLENGE (Gemini-Grade)
        if (resolvedIntent?.discourseType === 'NEW_TOPIC') {
            // If it's a new topic but AI is still talking about the previous topic (e.g. from history)
            if (state?.topic && state.topic !== 'GENERAL' && resLower.includes(state.topic.toLowerCase())) {
                // Only an issue if the new query doesn't mention the old topic
                if (!query.toLowerCase().includes(state.topic.toLowerCase())) {
                    issues.push(`Context Leak: AI is still discussing "${state.topic}" even though the user switched to a NEW_TOPIC.`);
                    severity = "HIGH";
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
