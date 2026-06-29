/**
 * SuggestionEngine Module (Gemini-like Contextual Follow-ups)
 * Responsibility: Generate high-relevance buttons based on the conversation context.
 */
class SuggestionEngine {
    /**
     * @param {Object} plan - The current AI plan.
     * @param {Object} context - { jobs, web, profile, state }
     * @param {Array} aiSuggestions - Suggestions already provided by the LLM.
     */
    static generate(plan, context, aiSuggestions = []) {
        let suggestions = [...aiSuggestions];

        const intent = plan.intent;
        const topic = context.state?.topic || "";
        const hasJobs = context.jobs && context.jobs.length > 0;

        // 1. Contextual Addition for Jobs
        if (hasJobs || topic !== "GENERAL") {
            if (intent === 'GOVT_JOB' || intent === 'JOB_QUERY') {
                suggestions.push(`Apply kaise karein?`);
                suggestions.push(`Fees kitni hai?`);
                suggestions.push(`Age limit kya hai?`);
            } else if (intent === 'FIELD_DETAILS') {
                suggestions.push(`Official link dikhao`);
                suggestions.push(`Syllabus kya hai?`);
                suggestions.push(`Aisi aur jobs batao`);
            }
        }

        // 2. Career Guidance
        if (intent === 'CAREER_GUIDANCE' || topic === 'CAREER') {
            suggestions.push(`12th ke baad best options`);
            suggestions.push(`Sarkari naukri kaise milti hai?`);
            suggestions.push(`High salary wali jobs`);
        }

        // 3. Profile based
        if (!context.profile?.qualification) {
            suggestions.push(`Meri profile update karein`);
        }

        // 4. Fallback for Empty results
        if (!hasJobs && !context.web && intent !== 'GREETING') {
            suggestions.push(`Latest jobs dikhao`);
            suggestions.push(`UP Police Bharti kab aayegi?`);
        }

        // Cleanup: Unique, Filter out long ones, Limit to 3
        return [...new Set(suggestions)]
            .filter(s => s.length > 2 && s.length < 35)
            .slice(0, 3);
    }
}

module.exports = SuggestionEngine;
