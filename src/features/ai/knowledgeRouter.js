/**
 * KnowledgeRouter Module
 * Responsibility: Decide and orchestrate where the information should be fetched from.
 *
 * Sources: Prompt Module, Conversation Memory, Search, Database, LLM.
 */
class KnowledgeRouter {
    /**
     * @param {Object} plan - The decision object from Planner.
     * @param {string} query - The query string.
     * @returns {Object} Route configuration
     */
    static route(plan, query) {
        const q = query.toLowerCase();
        const sources = [];

        // 1. Memory Route
        if (plan.needMemory) {
            sources.push('MEMORY'); // Chat history and User Insights
        }

        // 2. Database Route (Internal Job Listings / Jansewa)
        const dbIntents = ['GOVT_JOB', 'LATEST_VACANCY', 'JANSEWA'];
        if (dbIntents.includes(plan.intent)) {
            sources.push('DATABASE');
        }

        // 3. Search Route (External real-time data)
        // Rule: Never search greetings or simple calculations
        const searchExclusions = ['GREETING', 'THANKS', 'SMALL_TALK'];
        const isCalculation = q.match(/\d+[\+\-\*\/]\d+/) || q.includes('calculate') || q.includes('hisab');

        if (plan.needSearch && !searchExclusions.includes(plan.intent) && !isCalculation) {
            // Rule: Always search latest government notifications
            sources.push('SEARCH');
        }

        // 4. Prompt Route (Expert System Knowledge)
        sources.push('PROMPT_MODULES');

        // 5. LLM (Inherent Knowledge)
        sources.push('LLM_BASE');

        return {
            selectedSources: sources,
            isHybrid: sources.length > 1,
            primarySource: sources.includes('DATABASE') ? 'DATABASE' : (sources.includes('SEARCH') ? 'SEARCH' : 'LLM_BASE'),
            shouldFetchLiveData: sources.includes('DATABASE') || sources.includes('SEARCH')
        };
    }
}

module.exports = KnowledgeRouter;
