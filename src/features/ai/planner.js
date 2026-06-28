const UserProfile = require('./userProfile');

/**
 * Planner Module
 * Responsibility: Decide action, data source, modules, and response mode from resolved intent.
 */
class Planner {
    static plan(query, resolvedIntent, state = {}, profile = {}) {
        const missingFields = UserProfile.getMissingFields(profile);
        const primary = resolvedIntent.primaryIntent || 'GENERAL_QUERY';
        const domain = resolvedIntent.domainIntent || 'GENERAL';

        if (resolvedIntent.needClarification || resolvedIntent.confidence < 0.6) {
            return this._base({
                behavior: 'CLARIFY',
                intent: primary,
                resolvedIntent,
                domain,
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE'],
                missingFields,
                needClarification: true,
                reason: resolvedIntent.reason
            });
        }

        if (resolvedIntent.isPureGreeting || primary === 'GREETING') {
            return this._base({
                behavior: 'GREET',
                intent: 'GREETING',
                resolvedIntent,
                domain: 'NONE',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'],
                missingFields: [],
                responseMode: 'GREETING',
                needProfile: false
            });
        }

        const modules = this._modulesFor(domain, primary);
        const dataPolicy = this._dataPolicy(primary, domain);
        const needsDatabase = ['DATABASE_FIRST', 'DATABASE_ONLY', 'PREVIOUS_ITEM_DATABASE'].includes(dataPolicy);
        const needsSearch = ['OFFICIAL_SEARCH_IF_DB_FAILS', 'SEARCH_FIRST'].includes(dataPolicy);

        return this._base({
            behavior: primary === 'PROVIDE_QUALIFICATION' ? 'PROCESS_INPUT' : 'RESPOND',
            intent: primary,
            resolvedIntent,
            domain,
            priorityModules: modules,
            missingFields,
            needDatabase: needsDatabase,
            needSearch: needsSearch,
            needMemory: resolvedIntent.isFollowUp,
            needProfile: this._needsProfile(primary, domain),
            needClarification: false,
            isFollowUp: resolvedIntent.isFollowUp,
            referencedTopic: resolvedIntent.referencedTopic,
            referencedItem: resolvedIntent.referencedItem,
            responseMode: this._responseMode(primary, domain),
            dataPolicy,
            pagination: this._pagination(primary, state)
        });
    }

    static _base(overrides) {
        return {
            behavior: 'RESPOND',
            intent: 'GENERAL_QUERY',
            resolvedIntent: null,
            domain: 'GENERAL',
            priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'],
            missingFields: [],
            needDatabase: false,
            needSearch: false,
            needMemory: false,
            needProfile: false,
            needClarification: false,
            needReasoning: false,
            isFollowUp: false,
            referencedTopic: null,
            referencedItem: null,
            responseMode: 'DIRECT',
            dataPolicy: 'LLM_ONLY',
            pagination: null,
            ...overrides,
            isPureGreeting: overrides.intent === 'GREETING' || overrides.behavior === 'GREET'
        };
    }

    static _modulesFor(domain, primary) {
        const modules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'];
        const add = (m) => modules.push(m);

        if (domain === 'GOVT_JOB') add('GOVT_JOB');
        if (domain === 'CAREER') add('CAREER');
        if (domain === 'SCHOLARSHIP') add('SCHOLARSHIP');
        if (domain === 'RESUME') add('RESUME');
        if (domain === 'COLLEGE') add('COLLEGE');
        if (domain === 'RESULT_ADMIT_CARD') add('GOVT_JOB');

        if (['JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'APPLICATION_HELP', 'SCHOLARSHIP'].includes(primary)) {
            add('REASONING');
            add('VALIDATOR');
        }

        return [...new Set(modules)];
    }

    static _dataPolicy(primary, domain) {
        if (['JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS'].includes(primary)) return 'DATABASE_FIRST';
        if (['FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'APPLICATION_HELP', 'SHOW_FULL_DETAILS'].includes(primary)) return 'PREVIOUS_ITEM_DATABASE';
        if (domain === 'GOVT_JOB' || domain === 'RESULT_ADMIT_CARD') return 'DATABASE_FIRST';
        if (domain === 'SCHOLARSHIP') return 'OFFICIAL_SEARCH_IF_DB_FAILS';
        if (domain === 'CAREER' || domain === 'RESUME') return 'LLM_WITH_PROFILE';
        return 'LLM_ONLY';
    }

    static _needsProfile(primary, domain) {
        return ['JOB_QUERY', 'CAREER_GUIDANCE', 'PROVIDE_QUALIFICATION'].includes(primary) || domain === 'GOVT_JOB' || domain === 'CAREER';
    }

    static _responseMode(primary, domain) {
        if (primary === 'MORE_JOBS' || primary === 'MORE_RESULTS') return 'PAGINATED_LIST';
        if (primary.includes('DETAIL') || primary === 'APPLICATION_HELP' || primary === 'SHOW_FULL_DETAILS') return 'FIELD_ANSWER';
        if (domain === 'GOVT_JOB') return 'JOB_LIST';
        if (primary === 'EXPLAIN_LAST_FAILURE') return 'SHORT_EXPLANATION';
        return 'DIRECT';
    }

    static _pagination(primary, state = {}) {
        if (!['MORE_JOBS', 'MORE_RESULTS', 'MORE_SCHOLARSHIPS', 'MORE_COLLEGES'].includes(primary)) return null;
        return {
            offset: Number(state.nextOffset || 0),
            limit: 10,
            remainingCount: Number(state.remainingCount || 0),
            lastFilters: state.lastFilters || {}
        };
    }
}

module.exports = Planner;
