/**
 * KnowledgeRouter Module (Neural Decision Based)
 * Responsibility: Routes based on Neural Agentic Planner decisions.
 */
class KnowledgeRouter {
    static route(plan, query) {
        // Now entirely driven by the AgenticPlanner's neural decision (plan.needsDatabase, plan.needsWebSearch)
        const sources = ['PROMPT_MODULES', 'LLM_BASE'];

        if (plan.behavior === 'GREET') {
            return {
                selectedSources: sources,
                shouldCheckSearchIfDbFails: false,
                isFactualQuery: false,
                usePreviousContext: false
            };
        }

        if (plan.needsDatabase) {
            sources.push('DATABASE');
        }

        if (plan.needsWebSearch) {
            sources.push('SEARCH');
        }

        return {
            selectedSources: [...new Set(sources)],
            // In Neural-First, the planner already decided if we need search
            shouldCheckSearchIfDbFails: plan.needsWebSearch,
            isFactualQuery: plan.mode === 'JOB_SEARCH' || plan.mode === 'JOB_DETAILS',
            usePreviousContext: plan.usePreviousContext,
            pagination: plan.pagination || null
        };
    }
}

module.exports = KnowledgeRouter;
