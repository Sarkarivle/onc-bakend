/**
 * PromptComposer Module (Architectural Version 6.0 - Dynamic Prompt Builder)
 * Responsibility: Intelligent context injection, compression, and deduplication.
 */
const templates = require('./promptTemplates');
const TokenManager = require('./tokenManager');

class PromptComposer {
    /**
     * Builds a production-grade prompt system.
     */
    static async build(priorityModules, userData, liveData, meta) {
        const { plan, currentDate, turnCount } = meta;

        // 1. Context Compression (Saliency Logic)
        const compressedProfile = this._compressProfile(userData, plan);
        const compressedMemory = this._compressMemory(userData.insights, plan);
        const compressedHistory = this._compressHistory(userData.state?.history || []);

        // 2. Component Selection (Dynamic Context)
        const components = this._selectComponents(plan, priorityModules, currentDate);

        // 3. Build Data Blocks with Priorities
        let dataBlocks = [
            { name: 'PROFILE', content: compressedProfile, priority: 1 },
            { name: 'MEMORY', content: compressedMemory, priority: 2 },
            { name: 'HISTORY', content: compressedHistory, priority: 3 },
            { name: 'RAG', content: liveData.jobs || "", priority: 4 }
        ].filter(b => b.content);

        // 4. Token Budgeting & Pruning
        const prunedBlocks = TokenManager.prune(dataBlocks, TokenManager.BUDGETS.SYSTEM);

        // 5. Assemble System Prompt
        let systemPrompt = this._assemble(components, prunedBlocks);

        // 6. Deduplication & Final Polish
        systemPrompt = this._deduplicate(systemPrompt);

        // 7. Structure Output
        const metadata = {
            intent: plan.intent,
            turnCount: turnCount,
            blocksIncluded: prunedBlocks.map(b => b.name)
        };

        return {
            systemPrompt,
            messages: [], // Can be used for few-shot injection
            metadata,
            tokenEstimate: TokenManager.estimate(systemPrompt)
        };
    }

    /**
     * Injects only the profile fields relevant to the current plan.
     */
    static _compressProfile(profile, plan) {
        if (!profile) return "";
        const relevantFields = ['name'];

        if (['JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS'].includes(plan.intent)) {
            relevantFields.push('qualification', 'category', 'state');
        } else if (plan.intent === 'CAREER_GUIDANCE') {
            relevantFields.push('qualification', 'dob', 'state');
        }

        const filtered = {};
        relevantFields.forEach(f => { if (profile[f]) filtered[f] = profile[f]; });
        return Object.keys(filtered).length > 1 ? `[USER PROFILE]: ${JSON.stringify(filtered)}` : "";
    }

    /**
     * Summarizes memory or filters for relevance.
     */
    static _compressMemory(insights, plan) {
        if (!insights) return "";
        // If it's a greeting, we don't need deep memory insights
        if (plan.intent === 'GREETING') return "";

        return typeof insights === 'string' ? insights : JSON.stringify(insights);
    }

    /**
     * Sliding window history compression.
     */
    static _compressHistory(history) {
        if (!history || history.length === 0) return "";
        const window = history.slice(-3); // Only last 3 turns
        return window.map(h => `User: ${h.user}\nAI: ${h.assistant}`).join('\n---\n');
    }

    static _selectComponents(plan, priorityModules, currentDate) {
        const components = [
            templates.CORE,
            templates.STYLE,
            templates.REASONING,
            templates.SAFETY,
            templates.OUTPUT_FORMAT(currentDate)
        ];

        // Dynamic Intent Specific Module
        if (templates.DYNAMIC_COMPONENTS[plan.intent]) {
            components.push(templates.DYNAMIC_COMPONENTS[plan.intent]);
        }

        return components;
    }

    static _assemble(components, blocks) {
        let prompt = components.join('\n\n');
        prompt += '\n\n# CONTEXTUAL DATA\n';
        blocks.forEach(b => {
            prompt += `\n[${b.name}]:\n${b.content}\n`;
        });
        return prompt;
    }

    static _deduplicate(text) {
        const lines = text.split('\n');
        const uniqueLines = [...new Set(lines)];
        return uniqueLines.join('\n');
    }
}

module.exports = PromptComposer;
