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
                needsWebSearch: false,
                emotionalTone: resolvedIntent.tone || "POLITE"
            };
        }

        if (resolvedIntent.primaryIntent === 'SMALL_TALK') {
            return {
                tools: [],
                mode: "GENERAL_HELP",
                priorityModules: ["CORE", "PERSONALITY"],
                behavior: "RESPOND",
                needsDatabase: false,
                needsWebSearch: false,
                needsProfile: false,
                emotionalTone: resolvedIntent.tone || "CASUAL"
            };
        }

        const prompt = buildPrompt(refinedQuery, resolvedIntent, context);
        let plan = await LLMProvider.generateLogic(prompt);

        if (!plan) plan = this._fallbackPlan(resolvedIntent);

        // Enterprise Override: Ensure Mode matches Intent
        if (resolvedIntent.primaryIntent === 'FIELD_DETAILS') plan.mode = 'JOB_DETAILS';
        if (resolvedIntent.primaryIntent === 'DISCOVERY') plan.mode = 'JOB_SEARCH';

        // Upgrade: If career guidance is needed, force Reasoning Model
        if (plan.mode === 'CAREER_GUIDANCE') {
            plan.useReasoningModel = true;
            plan.priorityModules.push("CAREER");
        }

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
        const tone = resolvedIntent.tone || 'POLITE';

        if (['JOB_QUERY', 'JOB_SEARCH', 'DISCOVERY', 'FIELD_DETAILS', 'RESULT_ADMIT_CARD', 'APPLICATION_HELP'].includes(intent)) {
            return {
                tools: ["DATABASE"],
                mode: (intent === 'JOB_QUERY' || intent === 'JOB_SEARCH' || intent === 'DISCOVERY') ? "JOB_SEARCH" : "JOB_DETAILS",
                priorityModules: ["CORE", "GOVT_JOB"],
                behavior: "RESPOND",
                needsDatabase: true,
                needsWebSearch: false,
                needsProfile: false,
                emotionalTone: tone
            };
        }

        if (intent === 'PROFILE_INQUIRY') {
            return {
                tools: ["USER_PROFILE"],
                mode: "PROFILE_CHECK",
                priorityModules: ["CORE", "PERSONALITY"],
                behavior: "RESPOND",
                needsDatabase: false,
                needsWebSearch: false,
                needsProfile: true,
                emotionalTone: tone
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
                needsProfile: true,
                emotionalTone: tone
            };
        }

        if (intent === 'SMALL_TALK') {
            return {
                tools: [],
                mode: "GENERAL_HELP",
                priorityModules: ["CORE", "PERSONALITY"],
                behavior: "RESPOND",
                needsDatabase: false,
                needsWebSearch: false,
                needsProfile: false,
                emotionalTone: tone
            };
        }

        return {
            tools: [],
            mode: "GENERAL_HELP",
            priorityModules: ["CORE", "PERSONALITY"],
            behavior: "RESPOND",
            needsDatabase: false,
            needsWebSearch: false,
            needsProfile: false,
            emotionalTone: tone
        };
    }
}

module.exports = AgenticPlanner;
