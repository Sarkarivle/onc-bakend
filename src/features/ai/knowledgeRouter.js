/**
 * KnowledgeRouter Module
 * Implements DATABASE PRIORITY POLICY.
 */
class KnowledgeRouter {
    /**
     * @param {Object} plan - The decision object from Planner.
     * @param {string} query - The query string.
     * @returns {Object} Route configuration
     */
    static route(plan, query) {
        const q = query.toLowerCase();
        const sources = ['PROMPT_MODULES', 'LLM_BASE'];

        // Rule: Internal Database is ALWAYS Priority 1 for Jobs/Jansewa
        const isFactualQuery = ['GOVT_JOB', 'LATEST_VACANCY', 'JANSEWA', 'ELIGIBILITY', 'SALARY'].includes(plan.intent);

        if (isFactualQuery) {
            sources.push('DATABASE');
        }

        // Rule: Search is Priority 3 (Only if DB fails, handled in service)
        // But we must enable the capability here if needed.
        const needsLiveUpdate = q.includes('latest') || q.includes('current') || q.includes('2024') || q.includes('notification');

        return {
            selectedSources: sources,
            shouldCheckSearchIfDbFails: plan.needSearch || needsLiveUpdate,
            isFactualQuery: isFactualQuery
        };
    }
}

module.exports = KnowledgeRouter;
