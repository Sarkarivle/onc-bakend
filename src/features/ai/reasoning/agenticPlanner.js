/**
 * AgenticPlanner Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../generation/llmProvider');
const buildPrompt = require('./prompts/plannerPrompt');

class AgenticPlanner {
    static async generatePlan(refinedQuery, resolvedIntent, context = {}) {
        // Emergency mapping for Greetings to avoid search
        if (resolvedIntent.primaryIntent === 'GREETING') {
            return {
                tools: [],
                mode: "GENERAL_HELP",
                priorityModules: ["CORE", "PERSONALITY"],
                behavior: "GREET",
                needsDatabase: false,
                needsWebSearch: false
            };
        }

        const prompt = buildPrompt(refinedQuery, resolvedIntent, context);
        const plan = await LLMProvider.generate(prompt);

        if (!plan) return this._fallbackPlan(resolvedIntent);

        return {
            ...plan,
            tools: plan.tools || ["DATABASE"],
            priorityModules: plan.priorityModules || ["CORE", "GOVT_JOB"],
            behavior: plan.behavior || "RESPOND",
            needsDatabase: (plan.tools || []).includes('DATABASE'),
            needsWebSearch: (plan.tools || []).includes('WEB_SEARCH'),
            needsProfile: (plan.tools || []).includes('USER_PROFILE')
        };
    }

    /**
     * Decisions on what to do if the first search fails.
     */
    static async generatePivotPlan(query, previousError, context = {}) {
        const prompt = `
        The first search for "${query}" returned no results.
        Context: ${context.topic || 'General'}
        Reason: ${previousError}

        Instructions:
        1. Decide if we should try a different keyword for DATABASE.
        2. Or if we should switch to WEB_SEARCH.

        Return JSON:
        {
          "newSearchQuery": "Optimized keywords",
          "tool": "DATABASE | WEB_SEARCH",
          "reasoning": "Why this will work better"
        }`;

        return await LLMProvider.generate(prompt);
    }

    static _fallbackPlan(resolvedIntent = {}) {
        const intent = resolvedIntent.primaryIntent || 'GENERAL_QUERY';

        // Planner timeouts should not turn normal chat into job search. Only
        // factual job-like intents should touch retrieval in the fallback path.
        if (['JOB_QUERY', 'FIELD_DETAILS', 'RESULT_ADMIT_CARD', 'APPLICATION_HELP'].includes(intent)) {
            return {
                tools: ["DATABASE"],
                mode: intent === 'JOB_QUERY' ? "JOB_SEARCH" : "JOB_DETAILS",
                priorityModules: ["CORE", "GOVT_JOB"],
                behavior: "RESPOND",
                needsDatabase: true,
                needsWebSearch: false,
                needsProfile: false
            };
        }

        if (intent === 'CAREER_GUIDANCE') {
            return {
                tools: [],
                mode: "CAREER_GUIDANCE",
                priorityModules: ["CORE", "PERSONALITY", "CAREER"],
                behavior: "RESPOND",
                needsDatabase: false,
                needsWebSearch: false,
                needsProfile: true
            };
        }

        return {
            tools: [],
            mode: "GENERAL_HELP",
            priorityModules: ["CORE", "PERSONALITY"],
            behavior: "RESPOND",
            needsDatabase: false,
            needsWebSearch: false,
            needsProfile: false
        };
    }
}

module.exports = AgenticPlanner;
