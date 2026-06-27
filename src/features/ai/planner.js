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
        const { acts, domains } = intentObj;
        const missingFields = UserProfile.getMissingFields(profile);

        let behavior = 'RESPOND';
        let activeDomain = domains[0];
        let priorityModules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT', 'CONTEXT'];

        // 1. CONTEXT RESOLUTION (State-Driven)
        const isFollowUpAct = acts.includes('CONFIRM') || acts.includes('NEGATE') || acts.includes('EXTEND');
        const isResolvingPending = state.pendingAction && (acts.includes('CONFIRM') || acts.includes('INFORM'));

        if (acts.includes('NEGATE')) {
            behavior = 'RESPOND';
            activeDomain = 'GENERAL'; // Stop job flow if user says no
            priorityModules = ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'];
        } else if (isResolvingPending || (isFollowUpAct && state.lastDomain !== 'GENERAL')) {
            activeDomain = state.lastDomain !== 'GENERAL' ? state.lastDomain : activeDomain;
            behavior = 'RESPOND';
        } else if (isFollowUpAct && state.lastDomain === 'GENERAL' && acts.includes('CONFIRM')) {
            // User said "yes" to a general prompt - likely a follow-up to whatever AI just said
            behavior = 'RESPOND';
            activeDomain = 'GOVT_JOB'; // Default to jobs if they say yes to a career assistant
        }

        // 2. GREETING OVERRIDE (Minimalist Policy)
        if (acts.includes('GREET') && domains.includes('GENERAL')) {
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

        // 3. DOMAIN EVALUATION (Knowledge-Aware)
        const factualDomains = ['GOVT_JOB', 'CAREER', 'SCHOLARSHIP', 'COLLEGE'];
        if (factualDomains.includes(activeDomain) && !acts.includes('GREET')) {
            if (missingFields.length > 0) {
                behavior = 'DATA_GATHERING';
            }
        }

        // 4. DYNAMIC MODULE REGISTRY LOADING
        if (activeDomain !== 'GENERAL') {
            priorityModules.push(activeDomain);
        }

        // 5. BEHAVIORAL DIRECTIVES
        if (behavior === 'DATA_GATHERING') priorityModules.push('INTELLIGENCE');
        if (behavior === 'RESPOND' && activeDomain !== 'GENERAL') priorityModules.push('REASONING', 'VALIDATOR');

        return {
            behavior,
            intent: activeDomain,
            primaryAct: acts[0],
            priorityModules: [...new Set(priorityModules)],
            missingFields,
            needSearch: factualDomains.includes(activeDomain) && !acts.includes('GREET'),
            needReasoning: behavior === 'RESPOND'
        };
    }
}

module.exports = Planner;
