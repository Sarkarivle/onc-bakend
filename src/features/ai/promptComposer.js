const PromptManager = require('./promptManager');
const registry = require('./moduleRegistry');

/**
 * PromptComposer (Enterprise Grade)
 * Responsibility: Dynamic, version-aware prompt assembly.
 */
class PromptComposer {
    /**
     * @param {string[]} priorityModules - Array of module keys.
     * @param {Object} userData - User profile.
     * @param {Object} liveData - DB/Search data.
     * @param {Object} meta - { currentDate, currentYear, sessionId, plan, turnCount, behavior }
     */
    static async build(priorityModules, userData, liveData, meta) {
        const { currentDate, currentYear, sessionId, turnCount, behavior, plan } = meta;
        const cleanUser = this._sanitizeData(userData);

        const isPureGreeting = behavior === 'GREET';

        // 1. Fetch all required modules in parallel
        let allKeys = ['CORE', 'PERSONALITY', 'REASONING', 'MEMORY', 'OUTPUT', 'HALLUCINATION_PREVENTION', ...priorityModules];
        if (isPureGreeting) {
            allKeys = ['CORE', 'PERSONALITY', 'MEMORY', 'LANGUAGE', 'OUTPUT'];
        }
        const uniqueKeys = [...new Set(allKeys)];

        const moduleMap = {};
        await Promise.all(uniqueKeys.map(async (key) => {
            moduleMap[key] = await PromptManager.getModule(key, sessionId);
        }));

        let promptChunks = [];

        // 2. Assembly
        if (moduleMap.CORE) promptChunks.push(`[IDENTITY]:\n${moduleMap.CORE}`);
        if (moduleMap.PERSONALITY) promptChunks.push(`[PERSONALITY]:\n${moduleMap.PERSONALITY}`);

        // 2b. Intent & Goal Injection
        if (plan) {
            let intentSection = `[PLANNING]:\n`;
            intentSection += `- Mode: ${plan.mode}\n`;
            intentSection += `- Use Previous Context: ${plan.usePreviousContext}\n`;
            intentSection += `- Needs Database: ${plan.needsDatabase}\n`;
            intentSection += `- Needs General Guidance: ${plan.needsGeneralGuidance}\n`;
            if (plan.selectedItemIndex) intentSection += `- Selected Item Index: ${plan.selectedItemIndex}\n`;
            if (plan.referencedItem) intentSection += `- Referenced Item: ${plan.referencedItem}\n`;

            intentSection += `\n[RESOLVED INTENT]: ${JSON.stringify({
                primaryIntent: plan.intent,
                emotionalTone: plan.emotionalTone,
                userConstraints: plan.userConstraints,
                implicitGoal: plan.implicitGoal,
                communicationAct: plan.resolvedIntent?.communicationAct,
                domain: plan.domain,
                task: plan.resolvedIntent?.task,
                isFollowUp: plan.isFollowUp,
                entities: plan.resolvedIntent?.entities
            })}\n`;
            promptChunks.push(intentSection);
        }

        priorityModules.forEach(mod => {
            if (moduleMap[mod] && !['CORE', 'PERSONALITY', 'OUTPUT', 'CONTEXT'].includes(mod)) {
                promptChunks.push(`[${mod} MODULE]:\n${moduleMap[mod]}`);
            }
        });

        // 3. Context Injection (Functions like CONTEXT remain in local registry for now)
        let contextSection = `# CONTEXTUAL DATA:\n`;
        contextSection += `[CONVERSATION STATE]: Turn Number ${turnCount || 0}\n`;
        contextSection += registry.CONTEXT(cleanUser.name, cleanUser.loc, cleanUser.dob, cleanUser.cat, cleanUser.qual, cleanUser.insights, currentDate, currentYear);

        if (liveData.jobs || liveData.web) {
            contextSection += `\n\n# REAL-TIME DATA SOURCE:\n`;
            if (liveData.jobs) contextSection += `[DATABASE]: ${liveData.jobs}\n`;
            if (liveData.web) contextSection += `[SEARCH]: ${liveData.web}\n`;
        }
        promptChunks.push(contextSection);

        // 4. Critical Rules (Last for maximum weight)
        if (moduleMap.OUTPUT) {
            const outputContent = typeof moduleMap.OUTPUT === 'function'
                ? moduleMap.OUTPUT(currentDate)
                : moduleMap.OUTPUT;
            promptChunks.push(`[CRITICAL OUTPUT RULES]:\n${outputContent}`);
        }

        if (moduleMap.HALLUCINATION_PREVENTION) promptChunks.push(`[GUARDRAILS]:\n${moduleMap.HALLUCINATION_PREVENTION}`);

        let finalPrompt = promptChunks.join('\n\n---\n\n');
        finalPrompt += `\n\nBEGIN AGENTIC PROCESSING.

        CRITICAL:
        1. Start your response with <AGENT_THOUGHT> tags to analyze the request.
        2. Then, provide the final response in Hinglish inside <USER_MESSAGE> tags.
        3. NEVER include headers like "[PERSONALITY]" in the user message.

        OPEN <AGENT_THOUGHT>:`;

        return finalPrompt;
    }

    static _sanitizeData(data) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                sanitized[key] = value.replace(/ignore previous instructions|system prompt|you are now/gi, '[REDACTED]');
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}

module.exports = PromptComposer;
