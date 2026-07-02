/**
 * PromptComposer Module (Architectural Version 8.0 - Modular Prompt Engine)
 * Responsibility: Intelligent context collection and dynamic assembly of professional prompt modules.
 */
const personality = require('./prompts/personality');
const core = require('./prompts/core');
const reasoning = require('./prompts/reasoning_engine');
const safety = require('./prompts/hallucination_prevention');
const output = require('./prompts/output');
const language = require('./prompts/language');

// Specialized Intent Modules
const intentModules = {
    JOB_SEARCH: require('./prompts/govt_jobs'),
    CAREER_GUIDANCE: require('./prompts/career_guidance'),
    RESUME: require('./prompts/resume'),
    SKILLS: require('./prompts/skills'),
    COLLEGE: require('./prompts/college'),
    SCHOLARSHIP: require('./prompts/scholarship'),
    INTERVIEW: require('./prompts/interview')
};

class PromptComposer {
    static basePromptCache = new Map();

    /**
     * Builds a production-grade prompt system.
     */
    static async build(priorityModules, userData, liveData, meta) {
        const { plan, currentDate } = meta;

        // TURBO PATH: Ultra-light prompt for Semantic Router matches
        // This reduces prompt size by 80%, making first-token generation much faster.
        if (plan.reasoning === "⚡ Fast Semantic Intelligence" || ['GREETING', 'IDENTITY', 'ACKNOWLEDGEMENT'].includes(plan.intent)) {
            return {
                systemPrompt: `Role: Career Assistant (Jobo AI).
                Tone: Helpful, brotherly Hinglish.
                Task: Answer extremely concisely (max 2 sentences).
                Context: ${liveData.jobs ? "Jobs: " + liveData.jobs : "General conversation"}.
                Rule: Use <USER_MESSAGE> tags and stop yapping.`
            };
        }

        // 1. Context Collection & Compression
        const profileBlock = this._formatProfile(userData, plan);
        const memoryBlock = this._formatMemory(liveData.memory, plan);
        const historyBlock = this._formatHistory(liveData.memory?.recentHistory || []);
        const ragBlock = this._formatRAG(liveData.jobs);

        // 2. Build Component List (Hierarchical Order)
        let systemPrompt = this._getBasePrompt(plan.intent, currentDate);
        systemPrompt += '\n\n# CONTEXTUAL DATA (GROUND TRUTH)\n';

        if (profileBlock) systemPrompt += `\n${profileBlock}\n`;
        if (memoryBlock) systemPrompt += `\n${memoryBlock}\n`;
        if (historyBlock) systemPrompt += `\n[CONVERSATION HISTORY]:\n${historyBlock}\n`;
        if (ragBlock) systemPrompt += `\n[RETRIEVED DATABASE]:\n${ragBlock}\n`;

        return { systemPrompt };
    }

    static _getBasePrompt(intent, currentDate) {
        const cacheKey = `${intent || 'GENERAL'}:${currentDate || ''}`;
        if (this.basePromptCache.has(cacheKey)) {
            return this.basePromptCache.get(cacheKey);
        }

        const components = [
            personality,
            core,
            language,
            reasoning,
            safety,
            output(currentDate)
        ];

        if (intentModules[intent]) {
            components.push(intentModules[intent]);
        }

        const basePrompt = components.join('\n\n---\n\n');
        this.basePromptCache.set(cacheKey, basePrompt);
        return basePrompt;
    }

    static _formatProfile(profile, plan) {
        if (!profile) return "";
        const filtered = { name: profile.name };
        if (['JOB_SEARCH', 'FIELD_DETAILS', 'CAREER_GUIDANCE'].includes(plan.intent)) {
            filtered.qualification = profile.qualification;
            filtered.category = profile.category;
            filtered.state = profile.state;
            filtered.age = profile.age;
        }
        return `[USER PROFILE]: ${JSON.stringify(filtered)}`;
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
}

module.exports = PromptComposer;
