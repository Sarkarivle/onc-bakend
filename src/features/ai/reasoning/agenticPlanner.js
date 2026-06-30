/**
 * AgenticPlanner Module (Connected to Runpod Brain)
 */
const LLMProvider = require('../generation/llmProvider');
const buildPrompt = require('./prompts/plannerPrompt');

class AgenticPlanner {
    static async generatePlan(refinedQuery, resolvedIntent, context = {}) {
        const prompt = buildPrompt(refinedQuery, resolvedIntent, context);
        const plan = await LLMProvider.generate(prompt);

        if (!plan) return {
            tools: ["DATABASE"],
            mode: "JOB_SEARCH",
            priorityModules: ["CORE", "GOVT_JOB"],
            behavior: "RESPOND"
        };

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
}

module.exports = AgenticPlanner;
