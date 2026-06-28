const UserProfile = require('./userProfile');

/**
 * Planner Module (Upgraded to Response Planner Architecture)
 * Responsibility: Decide action, mode, data source, and context policy from resolved intent.
 */
class Planner {
    static plan(query, resolvedIntent, state = {}, profile = {}) {
        const q = query.toLowerCase().trim();
        const missingFields = UserProfile.getMissingFields(profile);
        const primary = resolvedIntent.primaryIntent || 'GENERAL_QUERY';
        const domain = resolvedIntent.domainIntent || 'GENERAL';

        // 1. Context Relevance Gate (Gemini-like Reasoning)
        let usePreviousContext = resolvedIntent.usePreviousContext;
        if (usePreviousContext === undefined || usePreviousContext === null) {
            usePreviousContext = this._shouldUseContext(q, resolvedIntent, state);
        }

        // Handle numeric references from followUp resolver
        const selectedItemIndex = resolvedIntent.entities?.itemIndex || resolvedIntent.selectedItemIndex || null;
        const referencedItem = usePreviousContext ? (resolvedIntent.referencedItem || state.lastShownItems?.[0]) : null;

        // 2. Decide Mode
        const mode = this._decideMode(primary, domain, resolvedIntent);

        // 3. Refusal Check (Safety)
        const shouldRefuse = this._shouldRefuse(q, resolvedIntent, state);

        if (resolvedIntent.needClarification || (resolvedIntent.confidence < 0.6 && !usePreviousContext)) {
            return this._base({
                mode: 'GENERAL_HELP',
                behavior: 'CLARIFY',
                intent: primary,
                resolvedIntent,
                domain,
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE'],
                missingFields,
                needClarification: true,
                usePreviousContext: false,
                reason: resolvedIntent.reason || "Low confidence/ambiguous query"
            });
        }

        if (resolvedIntent.isPureGreeting || primary === 'GREETING') {
            return this._base({
                mode: 'GREETING',
                behavior: 'GREET',
                intent: 'GREETING',
                resolvedIntent,
                domain: 'NONE',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'],
                missingFields: [],
                responseMode: 'GREETING',
                needProfile: false,
                usePreviousContext: false
            });
        }

        const modules = this._modulesFor(domain, primary, mode);
        const dataPolicy = this._dataPolicy(primary, domain, mode);
        const needsDatabase = ['DATABASE_FIRST', 'DATABASE_ONLY', 'PREVIOUS_ITEM_DATABASE'].includes(dataPolicy);
        const needsSearch = ['OFFICIAL_SEARCH_IF_DB_FAILS', 'SEARCH_FIRST'].includes(dataPolicy);
        const needsGeneralGuidance = (mode === 'CAREER_GUIDANCE' || mode === 'GENERAL_HELP');

        return this._base({
            mode,
            behavior: primary === 'PROVIDE_QUALIFICATION' ? 'PROCESS_INPUT' : 'RESPOND',
            intent: primary,
            resolvedIntent,
            domain,
            priorityModules: modules,
            missingFields,
            needDatabase: needsDatabase,
            needSearch: needsSearch,
            needsGeneralGuidance,
            needMemory: usePreviousContext,
            needProfile: this._needsProfile(primary, domain, mode),
            needClarification: false,
            isFollowUp: usePreviousContext,
            usePreviousContext,
            selectedItemIndex,
            referencedTopic: usePreviousContext ? resolvedIntent.referencedTopic : null,
            referencedItem: referencedItem,
            responseMode: this._responseMode(primary, domain, mode),
            dataPolicy,
            pagination: this._pagination(primary, state),
            shouldRefuse,
            reason: resolvedIntent.reason || `Planned for ${mode} mode.`
        });
    }

    static _base(overrides) {
        return {
            mode: 'GENERAL_HELP',
            behavior: 'RESPOND',
            intent: 'GENERAL_QUERY',
            resolvedIntent: overrides.resolvedIntent || null,
            domain: 'GENERAL',
            priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'],
            missingFields: [],
            needDatabase: false,
            needSearch: false,
            needsGeneralGuidance: false,
            needMemory: false,
            needProfile: false,
            needClarification: false,
            needReasoning: false,
            isFollowUp: false,
            usePreviousContext: false,
            selectedItemIndex: null,
            referencedTopic: null,
            referencedItem: null,
            responseMode: 'DIRECT',
            dataPolicy: 'LLM_ONLY',
            pagination: null,
            shouldRefuse: false,
            ...overrides,
            domain: overrides.domain || (overrides.resolvedIntent ? (overrides.resolvedIntent.domainIntent || 'GENERAL') : 'GENERAL'),            isPureGreeting: overrides.intent === 'GREETING' || overrides.behavior === 'GREET'
        };
    }

    /**
     * Context Relevance Gate Logic
     */
    static _shouldUseContext(q, resolvedIntent, state) {
        // More specific new-topic signals to avoid false positives on numeric references
        const newTopicRegex = /\b(police kaise bane|teacher kaise bane|engineer kaise bane|career|12th ke baad|10th ke baad|graduation ke baad|course|diploma|iti ke baad|mujhe .* banna hai|doctor banne|mbbs karu ya nursing)\b/i;
        if (newTopicRegex.test(q) && !/\d+\s*no|\d+\s*number/.test(q)) return false;

        // Career guidance usually resets unless it's a specific follow-up
        if (resolvedIntent.primaryIntent === 'CAREER_GUIDANCE' && !q.match(/\b(iske|usme|aur|more|details|is job)\b/i) && !/\d+\s*no|\d+\s*number/.test(q)) {
            return false;
        }

        // Reference words trigger context usage
        const referenceWords = /\b(ye|iski|iske|us|uski|uske|vo|wali|wala|4 no|4 number|item|job|apply|last date|fees|salary|link|details|batao|dikhao)\b/i;
        if (referenceWords.test(q)) return true;

        // Short confirmations/follow-ups trigger context usage
        if (resolvedIntent.communicationAct === 'CONFIRMATION' || resolvedIntent.communicationAct === 'FOLLOW_UP') {
            return true;
        }

        if (resolvedIntent.isFollowUp) return true;

        return false;
    }

    static _decideMode(primary, domain, resolvedIntent) {
        if (primary === 'GREETING') return 'GREETING';
        if (primary === 'JOB_QUERY') return 'JOB_SEARCH';
        if (['FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'SHOW_FULL_DETAILS'].includes(primary)) return 'JOB_DETAILS';
        if (primary.startsWith('MORE_')) return 'MORE_RESULTS';
        if (primary === 'CAREER_GUIDANCE' || domain === 'CAREER' || q.includes('doctor banne') || q.includes('mbbs karu ya nursing')) return 'CAREER_GUIDANCE';
        if (primary === 'SCHOLARSHIP' || domain === 'SCHOLARSHIP') return 'SCHOLARSHIP';
        if (primary === 'RESULT_ADMIT_CARD' || domain === 'RESULT' || domain === 'ADMIT_CARD' || domain === 'RESULT_ADMIT_CARD') return 'RESULT';
        if (primary === 'APPLICATION_HELP') return 'APPLICATION_HELP';
        return 'GENERAL_HELP';
    }

    static _shouldRefuse(q, resolvedIntent, state) {
        // Confirmation check - should never refuse unless previous context was unsafe
        if (resolvedIntent.communicationAct === 'CONFIRMATION') return false;

        // Logic for illegal/harmful would go here
        return false;
    }

    static _modulesFor(domain, primary, mode) {
        const modules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'];
        const add = (m) => modules.push(m);

        if (this._isJobDomain(domain) || mode === 'JOB_SEARCH' || mode === 'JOB_DETAILS') add('GOVT_JOB');
        if (mode === 'CAREER_GUIDANCE') add('CAREER');
        if (mode === 'SCHOLARSHIP') add('SCHOLARSHIP');
        if (domain === 'RESUME') add('RESUME');
        if (domain === 'COLLEGE') add('COLLEGE');
        if (domain === 'RESULT_ADMIT_CARD' || mode === 'RESULT') add('GOVT_JOB');

        if (['JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'APPLICATION_HELP', 'SCHOLARSHIP'].includes(primary)) {
            add('REASONING');
            add('VALIDATOR');
        }

        return [...new Set(modules)];
    }

    static _dataPolicy(primary, domain, mode) {
        if (mode === 'JOB_SEARCH' || mode === 'MORE_RESULTS') return 'DATABASE_FIRST';
        if (mode === 'JOB_DETAILS') return 'PREVIOUS_ITEM_DATABASE';
        if (this._isJobDomain(domain) || domain === 'RESULT_ADMIT_CARD' || mode === 'RESULT') return 'DATABASE_FIRST';
        if (mode === 'SCHOLARSHIP') return 'OFFICIAL_SEARCH_IF_DB_FAILS';
        if (mode === 'CAREER_GUIDANCE' || domain === 'RESUME') return 'LLM_WITH_PROFILE';
        return 'LLM_ONLY';
    }

    static _needsProfile(primary, domain, mode) {
        return ['JOB_QUERY', 'CAREER_GUIDANCE', 'PROVIDE_QUALIFICATION'].includes(primary) ||
               this._isJobDomain(domain) ||
               mode === 'CAREER_GUIDANCE' ||
               mode === 'JOB_SEARCH';
    }

    static _responseMode(primary, domain, mode) {
        if (mode === 'MORE_RESULTS') return 'PAGINATED_LIST';
        if (mode === 'JOB_DETAILS') return 'FIELD_ANSWER';
        if (mode === 'JOB_SEARCH') return 'JOB_LIST';
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

    static _isJobDomain(domain) {
        return ['GOVT_JOB', 'RAILWAY_JOB', 'BANK_JOB', 'POLICE_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'].includes(domain);
    }
}

module.exports = Planner;
