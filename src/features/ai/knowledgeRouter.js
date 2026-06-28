/**
 * KnowledgeRouter Module
 * Routes by resolved intent and planner data policy.
 */
class KnowledgeRouter {
    static route(plan, query) {
        const q = (query || "").toLowerCase();
        const sources = ['PROMPT_MODULES', 'LLM_BASE'];

        if (plan.isPureGreeting || plan.behavior === 'GREET' || plan.intent === 'GREETING') {
            return {
                selectedSources: sources,
                shouldCheckSearchIfDbFails: false,
                isFactualQuery: false,
                usePreviousContext: false
            };
        }

        const dataPolicy = plan.dataPolicy || 'LLM_ONLY';
        const factual = this._isFactual(plan);

        if (['DATABASE_FIRST', 'DATABASE_ONLY', 'PREVIOUS_ITEM_DATABASE'].includes(dataPolicy) || plan.needDatabase) {
            sources.push('DATABASE');
        }

        const latest = /(latest|new|nayi|recent|fresh|upcoming|notification|today|current|abhi)/i.test(q);
        const officialSearch = dataPolicy === 'OFFICIAL_SEARCH_IF_DB_FAILS' || latest || plan.intent === 'RESULT_ADMIT_CARD';
        if (dataPolicy === 'SEARCH_FIRST') sources.push('SEARCH');

        return {
            selectedSources: [...new Set(sources)],
            shouldCheckSearchIfDbFails: Boolean((plan.needSearch || officialSearch) && plan.intent !== 'GREETING'),
            isFactualQuery: factual,
            usePreviousContext: Boolean(plan.isFollowUp || dataPolicy === 'PREVIOUS_ITEM_DATABASE'),
            pagination: plan.pagination || null
        };
    }

    static _isFactual(plan) {
        const factualIntents = new Set([
            'JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'FIELD_DETAILS', 'JOB_FEE_DETAILS',
            'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'APPLICATION_HELP', 'SHOW_FULL_DETAILS',
            'SCHOLARSHIP', 'RESULT_ADMIT_CARD', 'MORE_SCHOLARSHIPS', 'MORE_COLLEGES'
        ]);

        const factualDomains = new Set(['GOVT_JOB', 'RAILWAY_JOB', 'BANK_JOB', 'POLICE_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB', 'SCHOLARSHIP', 'COLLEGE', 'RESULT_ADMIT_CARD']);
        return factualIntents.has(plan.intent) || factualDomains.has(plan.domain);
    }
}

module.exports = KnowledgeRouter;
