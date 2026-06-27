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
        }

        // 2. GREETING OVERRIDE (Minimalist Policy)
        // If it's a greeting and NOT mixed with a domain request, force minimalist behavior.
        if (acts.includes('GREET') && domains.includes('GENERAL')) {
            return {
                behavior: 'GREET',
                intent: 'GENERAL',
                primaryAct: 'GREET',
                priorityModules: ['CORE', 'PERSONALITY', 'LANGUAGE', 'OUTPUT'], // NO Gov Jobs, NO Career
                missingFields: [],
                needSearch: false,
                needReasoning: false
            };
        }

        // 3. DOMAIN EVALUATION (Knowledge-Aware)
        const factualDomains = ['GOVT_JOB', 'CAREER', 'SCHOLARSHIP', 'COLLEGE'];
        if (factualDomains.includes(activeDomain) && !acts.includes('GREET')) {
            // Check if profile gaps exist for domains that require eligibility checks
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
