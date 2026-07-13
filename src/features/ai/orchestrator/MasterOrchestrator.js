/**
 * MasterOrchestrator v31.0 - (IMMUNE SYSTEM UPGRADE)
 * Responsibility: Resilient Intent Mapping and Persona Protection.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getFormatting, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    static async classifyIntent(userQuery) {
        const lowerQuery = userQuery.toLowerCase().trim();
        const greetingPattern = /^(hi|hello|hey|namaste|ram ram|kaise ho|ji|bhai|jobo|good morning|gm|gn|good night)/i;
        if (greetingPattern.test(lowerQuery) && lowerQuery.split(' ').length <= 6) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        const prompt = `Select 1-2 categories: ['JOB_SEARCH', 'MATH', 'WELLNESS', 'ROADMAP', 'SSC', 'POLICE', 'BANKING', 'UPSC', 'GENERAL'].
Query: "${userQuery}"
Output ONLY JSON: {"intents": ["CAT1"], "mood": "NEUTRAL"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            let intents = result?.intents || ['GENERAL'];
            const q = lowerQuery;

            // Precision Keywords (Prevents False Positives)
            if (q.includes('roadmap do') || q.includes('kaise taiyari kare') || q.includes('master plan')) {
                if (!intents.includes('ROADMAP')) intents.push('ROADMAP');
            }
            if (q.includes('ssc ') && !intents.includes('SSC')) intents.push('SSC');

            return { intents, mood: result?.mood || 'NEUTRAL' };
        } catch (e) { return { intents: ['GENERAL'], mood: 'NEUTRAL' }; }
    }

    static async processUserQuery(userMessage, chatHistory, context) {
        const { intents, mood } = context.image_url ? { intents: ['UTILITY'], mood: 'NEUTRAL' } : await this.classifyIntent(userMessage);
        const selectedTools = getToolsByCategory(intents);

        const basePersona = getPersona(context.profile?.name, intents.includes('GREETING'), mood, intents);
        const capabilities = getModePrompt(intents, context.profile);
        const format = getFormatting();

        const finalPrompt = `${capabilities}\n\n${basePersona}\n\n${format}`;
        return await AgentLoop.run(userMessage, chatHistory, context, finalPrompt, selectedTools, intents);
    }
}

module.exports = MasterOrchestrator;
