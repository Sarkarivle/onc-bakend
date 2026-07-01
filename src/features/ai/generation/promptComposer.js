/**
 * PromptComposer Module (Architectural Version 7.0 - Dynamic Builder)
 * Responsibility: Intelligent context collection, compression, and deduplication.
 */
const templates = require('./promptTemplates');

class PromptComposer {
    /**
     * Builds a production-grade prompt system.
     */
    static async build(priorityModules, userData, liveData, meta) {
        const { plan, currentDate } = meta;

        // 1. Context Collection & Compression
        const profileBlock = this._formatProfile(userData, plan);
        const memoryBlock = this._formatMemory(liveData.memory, plan);
        const historyBlock = this._formatHistory(liveData.memory?.recentHistory || []);
        const ragBlock = this._formatRAG(liveData.jobs);

        // 2. Build Component List
        const components = [
            templates.CORE,
            templates.STYLE,
            templates.REASONING,
            templates.SAFETY,
            templates.OUTPUT_FORMAT(currentDate)
        ];

        // 3. Dynamic Intent Components
        if (templates.DYNAMIC_COMPONENTS[plan.intent]) {
            components.push(templates.DYNAMIC_COMPONENTS[plan.intent]);
        }

        // 4. Assemble Final System Prompt
        let systemPrompt = components.join('\n\n');
        systemPrompt += '\n\n# CONTEXTUAL DATA\n';

        if (profileBlock) systemPrompt += `\n${profileBlock}\n`;
        if (memoryBlock) systemPrompt += `\n${memoryBlock}\n`;
        if (historyBlock) systemPrompt += `\n[CONVERSATION HISTORY]:\n${historyBlock}\n`;
        if (ragBlock) systemPrompt += `\n[RETRIEVED DATABASE]:\n${ragBlock}\n`;

        return { systemPrompt };
    }

    static _formatProfile(profile, plan) {
        if (!profile) return "";
        const filtered = { name: profile.name };
        if (['JOB_SEARCH', 'FIELD_DETAILS', 'CAREER_GUIDANCE'].includes(plan.intent)) {
            filtered.qualification = profile.qualification;
            filtered.category = profile.category;
            filtered.state = profile.state;
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
