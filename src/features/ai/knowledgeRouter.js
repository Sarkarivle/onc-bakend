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

        // Upgraded factual check for new domains
        const jobRelatedDomains = [
            'GOVT_JOB', 'EXAM', 'POLICE_JOB', 'RAILWAY_JOB',
            'BANK_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'
        ];

        const isFactualQuery = jobRelatedDomains.includes(plan.intent) ||
                              ['CAREER', 'SCHOLARSHIP', 'COLLEGE', 'RESUME', 'LATEST_VACANCY', 'JANSEWA', 'ELIGIBILITY', 'SALARY'].includes(plan.intent);

        if (isFactualQuery) {
            sources.push('DATABASE');
        }

        // Search decision
        const needsLiveUpdate = q.includes('latest') || q.includes('new') || q.includes('nayi') || q.includes('upcoming') || q.includes('notification');

        return {
            selectedSources: sources,
            shouldCheckSearchIfDbFails: plan.needSearch || needsLiveUpdate,
            isFactualQuery: isFactualQuery
        };
    }
}

module.exports = KnowledgeRouter;
