/**
 * MasterOrchestrator v28.0 - (GEMINI 3 SOVEREIGN MIND)
 * Final Tiered Assembly for Maximum Command Compliance.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getFormatting, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    static async classifyIntent(userQuery) {
        const lowerQuery = userQuery.toLowerCase().trim();
        const greetingPattern = /^(hi|hello|hey|namaste|ram ram|kaise ho|ji|bhai|jobo|good morning)/i;
        if (greetingPattern.test(lowerQuery) && lowerQuery.split(' ').length <= 6) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        const prompt = `Select 1-3 categories for query: "${userQuery}".
Categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'ROADMAP', 'SSC', 'POLICE', 'BANKING', 'UPSC', 'GENERAL'].
Output ONLY JSON: {"intents": ["CAT1"], "mood": "NEUTRAL"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            let intents = result?.intents || ['GENERAL'];
            const q = lowerQuery;
            if (q.includes('kya kare') || q.includes('kaise') || q.includes('plan') || q.includes('roadmap') || q.includes('strategy') || q.includes('taiari')) {
                if (!intents.includes('ROADMAP')) intents.push('ROADMAP');
            }
            return { intents, mood: result?.mood || 'NEUTRAL' };
        } catch (e) { return { intents: ['GENERAL'], mood: 'NEUTRAL' }; }
    }

    static async processUserQuery(userMessage, chatHistory, context) {
        const { intents, mood } = context.image_url ? { intents: ['UTILITY'], mood: 'NEUTRAL' } : await this.classifyIntent(userMessage);
        const selectedTools = getToolsByCategory(intents);

        // TIERED ASSEMBLY
        const basePersona = getPersona(context.profile?.name, intents.includes('GREETING'), mood, intents);
        const capabilities = getModePrompt(intents, context.profile);
        const format = getFormatting();

        // The model sees formatting LAST, ensuring strict visual compliance
        const finalPrompt = `${capabilities}\n\n${basePersona}\n\n${format}`;

        return await AgentLoop.run(userMessage, chatHistory, context, finalPrompt, selectedTools, intents);
    }
}

module.exports = MasterOrchestrator;
