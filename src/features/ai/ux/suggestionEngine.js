/**
 * SuggestionEngine Module
 * Responsibility: Generates contextual follow-up suggestions (chips).
 */
class SuggestionEngine {
    static generate(plan, context, aiSuggestions = []) {
        // Priority to Neural Suggestions from LLM
        if (Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
            return aiSuggestions.slice(0, 3);
        }

        if (!plan) return [];
        const intent = plan.intent || plan.mode || "";
        const topic = context?.state?.topic || context?.topic || "";
        const hasJobs = context?.jobs && context.jobs.length > 0;

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

        if (intent === 'CAREER_GUIDANCE' || topic === 'CAREER') {
            suggestions.push(`12th ke baad best options`);
            suggestions.push(`Sarkari naukri kaise milti hai?`);
            suggestions.push(`High salary wali jobs`);
        }

        return [...new Set(suggestions)]
            .filter(s => s.length > 2 && s.length < 35)
            .slice(0, 3);
    }
}

module.exports = SuggestionEngine;
