const UserProfile = require('./userProfile');

/**
 * Planner Module (Enterprise Generalized Orchestrator)
 * Responsibility: Pure behavior logic based on context resolution.
 */
class Planner {
    /**
     * @param {string} query - Raw input.
     * @param {Object} intentObj - { acts, domains } from IntentDetector.
     * @param {Object} state - ConversationState { pendingAction, turnCount, lastDomain }.
     * @param {Object} profile - UserProfile.
     */
    static plan(query, intentObj, state, profile) {
        const { acts, domains, intents, isPureGreeting } = intentObj;
        const missingFields = UserProfile.getMissingFields(profile);
        const q = query.trim();

        let behavior = 'RESPOND';
        let activeDomain = domains[0] || 'GENERAL';
        let priorityModules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT', 'CONTEXT'];

        // 0. PURE GREETING ISOLATION (New Upgrade)
        if (isPureGreeting) {
            return {
                behavior: 'GREET',
                intent: 'GREETING',
                primaryAct: 'GREET',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'],
                missingFields: [],
                needSearch: false,
                needReasoning: false,
                isPureGreeting: true
            };
        }

        // 1. AMBIGUITY DETECTION (New Upgrade)
        // Agar query bahut choti hai aur koi specific intent nahi mila
        const isAmbiguous = q.length < 10 &&
                           intents.includes('GENERAL_QUERY') &&
                           !acts.includes('GREET') &&
                           !acts.includes('CONFIRM') &&
                           !acts.includes('NEGATE') &&
                           !acts.includes('EXTEND');

        if (isAmbiguous) {
            return {
                behavior: 'CLARIFY',
                intent: 'GENERAL',
                primaryAct: 'INQUIRE',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE'],
                missingFields: [],
                needSearch: false,
                needReasoning: false
            };
        }

        // 2. CONTEXT RESOLUTION (State-Driven)
        const isFollowUpAct = acts.includes('CONFIRM') || acts.includes('NEGATE') || acts.includes('EXTEND');
        const isResolvingPending = state.pendingAction && (acts.includes('CONFIRM') || acts.includes('INFORM'));

        if (acts.includes('NEGATE')) {
            behavior = 'RESPOND';
            activeDomain = 'GENERAL';
            priorityModules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'];
        } else if (isResolvingPending || (isFollowUpAct && state.lastDomain !== 'GENERAL')) {
            activeDomain = (state.lastDomain && state.lastDomain !== 'GENERAL') ? state.lastDomain : activeDomain;
            behavior = 'RESPOND';
        }

        // 2. GREETING OVERRIDE
        if (acts.includes('GREET') && activeDomain === 'GENERAL') {
            return {
                behavior: 'GREET',
                intent: 'GENERAL',
                primaryAct: 'GREET',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE'],
                missingFields: [],
                needSearch: false,
                needReasoning: false
            };
        }

        // 3. DOMAIN EVALUATION (Upgraded for New IntentDetector Domains)
        const jobRelatedDomains = [
            'GOVT_JOB', 'EXAM', 'POLICE_JOB', 'RAILWAY_JOB',
            'BANK_JOB', 'DEFENCE_JOB', 'TEACHING_JOB', 'HEALTH_JOB'
        ];
        const factualDomains = [...jobRelatedDomains, 'CAREER', 'SCHOLARSHIP', 'COLLEGE', 'RESUME'];

        if (factualDomains.includes(activeDomain) && !acts.includes('GREET')) {
            behavior = 'RESPOND';
        }

        // 4. DYNAMIC MODULE REGISTRY LOADING
        // Map detailed domains back to primary modules if needed
        if (jobRelatedDomains.includes(activeDomain)) {
            priorityModules.push('GOVT_JOB');
        } else if (activeDomain !== 'GENERAL') {
            priorityModules.push(activeDomain);
        }

        // 5. BEHAVIORAL DIRECTIVES
        if (behavior === 'DATA_GATHERING') priorityModules.push('INTELLIGENCE');
        if (behavior === 'RESPOND' && activeDomain !== 'GENERAL') priorityModules.push('REASONING', 'VALIDATOR');

        return {
            behavior,
            intent: activeDomain,
            specificIntents: Array.from(intents || []),
            primaryAct: acts[0],
            priorityModules: [...new Set(priorityModules)],
            missingFields,
            needSearch: factualDomains.includes(activeDomain) && !acts.includes('GREET'),
            needReasoning: behavior === 'RESPOND'
        };
    }
}

module.exports = Planner;
