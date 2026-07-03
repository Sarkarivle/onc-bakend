/**
 * PromptComposer Module (Architectural Version 8.0 - Modular Prompt Engine)
 * Responsibility: Intelligent context collection and dynamic assembly of professional prompt modules.
 */
const personality = require('./prompts/Brainprompt/personality');
const core = require('./prompts/Brainprompt/core');
const reasoning = require('./prompts/Brainprompt/reasoning_engine');
const safety = require('./prompts/Brainprompt/hallucination_prevention');
const language = require('./prompts/Brainprompt/language');

// New Intent-Based Output Modules
const outputModules = {
    JOB_SEARCH: require('./prompts/output/output_jobs'),
    CAREER_GUIDANCE: require('./prompts/output/output_career'),
    SKILLS: require('./prompts/output/output_career'),
    COLLEGE: require('./prompts/output/output_career'),
    GENERAL: require('./prompts/output/output_general'),
    GREETING: require('./prompts/output/output_general'),
    IDENTITY: require('./prompts/output/output_general')
};

// Specialized Intent Modules (Organized by Feature)
const intentModules = {
    JOB_SEARCH: require('./prompts/specialists/govt_jobs'),
    CAREER_GUIDANCE: require('./prompts/specialists/career_guidance'),
    RESUME: require('./prompts/specialists/resume'),
    SKILLS: require('./prompts/specialists/skills'),
    COLLEGE: require('./prompts/specialists/college'),
    SCHOLARSHIP: require('./prompts/specialists/scholarship'),
    INTERVIEW: require('./prompts/specialists/interview')
};

class PromptComposer {
    static basePromptCache = new Map();

    /**
     * Builds a production-grade prompt system.
     */
    static async build(priorityModules, userData, liveData, meta) {
        const { plan = {}, currentDate } = meta || {};

        // TURBO PATH: Temporarily disabled to ensure context retention in follow-ups.
        /*
        if (plan.reasoning === "⚡ Fast Semantic Intelligence" || ['GREETING', 'IDENTITY', 'ACKNOWLEDGEMENT'].includes(plan.intent)) {
            return {
                systemPrompt: `Role: Career Assistant (Jobo AI).
                Tone: Helpful, brotherly Hinglish.
                Task: Answer extremely concisely (max 2 sentences).
                Context: ${liveData.jobs ? "Jobs: " + liveData.jobs : "General conversation"}.
                Rule: Do NOT use any tags like <USER_MESSAGE> or <AGENT_THOUGHT> in the final output.`
            };
        }
        */

        // 1. Context Collection & Compression
        const profileBlock = this._formatProfile(userData, plan);
        const memoryBlock = this._formatMemory(liveData.memory, plan);
        const historyBlock = this._formatHistory(liveData.memory?.recentHistory || []);
        const ragBlock = this._formatRAG(liveData.jobs);
        const plannerBlock = this._formatPlanner(plan);
        const cognitiveMapBlock = this._formatCognitiveMap(plan.cognitiveMap);
        const toolBlock = this._formatToolResults(liveData);

        // 2. Build Component List (Hierarchical Order)
        let systemPrompt = this._getBasePrompt(plan, currentDate);
        systemPrompt += '\n\n# CONTEXTUAL DATA (GROUND TRUTH)\n';

        if (cognitiveMapBlock) systemPrompt += `\n${cognitiveMapBlock}\n`;
        if (plannerBlock) systemPrompt += `\n${plannerBlock}\n`;
        if (profileBlock) systemPrompt += `\n${profileBlock}\n`;
        if (memoryBlock) systemPrompt += `\n${memoryBlock}\n`;
        if (historyBlock) systemPrompt += `\n[CONVERSATION HISTORY]:\n${historyBlock}\n`;
        if (ragBlock) systemPrompt += `\n[RETRIEVED DATABASE]:\n${ragBlock}\n`;
        if (toolBlock) systemPrompt += `\n[TOOL RESULTS]:\n${toolBlock}\n`;
        if (plan.refinedQuery) systemPrompt += `\n[CANONICAL USER QUERY]: ${plan.refinedQuery}\n`;

        return { systemPrompt };
    }

    static _getBasePrompt(plan, currentDate) {
        const planIntent = (typeof plan === 'string' ? plan : plan.intent) || 'GENERAL';

        // Normalize intent (Handle spaces and underscores)
        let inferredIntent = planIntent.toUpperCase().trim().replace(/\s+/g, '_');

        const goalType = (plan.goal_type || "").toLowerCase();
        const refinedQuery = (plan.refinedQuery || "").toLowerCase();

        // HEURISTIC: Fix common misclassifications from the Planner
        // If it's a planning/recommendation task, it should be CAREER_GUIDANCE even if labeled as JOB_SEARCH
        if (inferredIntent === 'JOB_SEARCH' || inferredIntent === 'GENERAL') {
            const isPlanning = goalType.includes('planning') || goalType.includes('recommendation') || goalType.includes('analysis');
            const isNegation = refinedQuery.includes('nahi') || refinedQuery.includes('not') || refinedQuery.includes('no ');

            if (isPlanning || (isNegation && (refinedQuery.includes('job') || refinedQuery.includes('naukri')))) {
                inferredIntent = 'CAREER_GUIDANCE';
            }
        }

        // Map Goal Type to specific Prompt Modules if intent is still generic
        if (inferredIntent === 'GENERAL' && goalType) {
            if (goalType.includes('information_retrieval')) {
                inferredIntent = 'JOB_SEARCH';
            }
        }

        const cacheKey = `${inferredIntent}:${currentDate || ''}`;
        if (this.basePromptCache.has(cacheKey)) {
            return this.basePromptCache.get(cacheKey);
        }

        // Dynamically select the output module based on inferred intent
        const output = outputModules[inferredIntent] || outputModules.GENERAL;

        const components = [
            personality,
            core,
            language,
            reasoning,
            safety,
            output(currentDate)
        ];

        if (intentModules[inferredIntent]) {
            components.push(intentModules[inferredIntent]);
        }

        const basePrompt = components.join('\n\n---\n\n');
        this.basePromptCache.set(cacheKey, basePrompt);
        return basePrompt;
    }

    static _formatProfile(profile, plan) {
        if (!profile) return "";

        // Priority fields for the LLM to know who the user is
        const fullProfileIntents = [
            'JOB_SEARCH', 'FIELD_DETAILS', 'CAREER_GUIDANCE',
            'PROFILE_INQUIRY', 'ORDINAL_FOLLOWUP', 'DISCOVERY',
            'RESUME', 'INTERVIEW', 'SKILLS'
        ];

        const intent = String(plan.intent || '').toUpperCase();

        if (fullProfileIntents.includes(intent)) {
            return `[USER PROFILE - CRITICAL CONTEXT]:
            - Name: ${profile.name}
            - Qualification: ${profile.qualification || 'Not provided'}
            - Category: ${profile.category || 'General'}
            - State/Location: ${profile.state || 'Not provided'}
            - DOB/Age: ${profile.dob || profile.age || 'Not provided'}
            - Gender: ${profile.gender || 'Not provided'}
            - Insights: ${profile.insights || ''}`;
        }

        return `[USER NAME]: ${profile.name}`;
    }

    static _formatMemory(memory, plan) {
        if (!memory || !memory.facts || memory.facts.length === 0) return "";
        return `[LONG-TERM MEMORY]: ${memory.facts.join('. ')}`;
    }

    static _formatHistory(history) {
        if (!history || history.length === 0) return "";
        return history.map(h => `User: ${h.user}\nAI: ${h.assistant}`).join('\n---\n');
    }

    static _formatRAG(jobs) {
        if (!jobs) return "";
        return jobs;
    }

    static _formatPlanner(plan) {
        if (!plan) return "";
        return `[PLANNER OUTPUT]:
        - Intent: ${plan.intent || 'GENERAL_QUERY'}
        - Mode: ${plan.mode || 'GENERAL_HELP'}
        - Behavior: ${plan.behavior || 'RESPOND'}
        - Confidence: ${plan.confidence || 0.5}
        - Tools: ${(plan.tools || []).join(', ') || 'LLM'}
        - Needs RAG: ${Boolean(plan.needsRAG)}
        - Needs Memory: ${Boolean(plan.needsMemory)}
        - Refined Query: ${plan.refinedQuery || ''}`;
    }

    static _formatCognitiveMap(cognitiveMap) {
        if (!cognitiveMap) return "";
        return `[COGNITIVE MAP JSON]:
${JSON.stringify(cognitiveMap, null, 2)}`;
    }

    static _formatToolResults(liveData = {}) {
        const entries = [];
        if (liveData.calculator) entries.push(`Calculator: ${liveData.calculator}`);
        if (liveData.searchResults) entries.push(`Search: ${liveData.searchResults}`);
        if (liveData.databaseResults) entries.push(`Database: ${liveData.databaseResults}`);
        return entries.join('\n');
    }
}

module.exports = PromptComposer;
