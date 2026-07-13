/**
 * MasterOrchestrator v26.0 - (SOVEREIGN DYNAMIC GOVERNOR)
 * Responsibility: High-Precision Intent Mapping and Context Persistence.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getFormatting, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    static async classifyIntent(userQuery, chatHistory = []) {
        const lowerQuery = userQuery.toLowerCase().trim();

        // 1. FAST GREETING DETECTOR
        const greetingPattern = /^(hi|hello|hey|hlo|hii|namaste|ram ram|kaise ho|ji|bhai|jobo|good morning|gm|gn|good night)/i;
        if (greetingPattern.test(lowerQuery) && lowerQuery.split(' ').length <= 6) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        // 2. HARD-CODED KEYWORD BIAS (Prevents AI logic errors)
        const keywordIntents = [];
        if (lowerQuery.includes('ssc')) keywordIntents.push('SSC');
        if (lowerQuery.includes('bank')) keywordIntents.push('BANKING');
        if (lowerQuery.includes('police')) keywordIntents.push('POLICE');
        if (lowerQuery.includes('math') || lowerQuery.includes('ganit')) keywordIntents.push('MATH');
        if (lowerQuery.includes('syllabus')) keywordIntents.push('SYLLABUS');
        if (lowerQuery.includes('kya kare') || lowerQuery.includes('kaise') || lowerQuery.includes('plan') || lowerQuery.includes('roadmap')) {
            keywordIntents.push('ROADMAP');
        }

        // 3. LLM LOGIC CLASSIFICATION
        const prompt = `Classify Intents (Select 1-3): ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'ROADMAP', 'SSC', 'POLICE', 'BANKING', 'UPSC', 'GENERAL'].
Query: "${userQuery}"
Output JSON: {"intents": ["CAT1"], "mood": "MOOD"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            let intents = result?.intents || ['GENERAL'];

            // Merge keyword intents with LLM results (deduplicated)
            intents = [...new Set([...intents, ...keywordIntents])];

            // 4. SMART FILTERING: Specific beats General
            if (intents.includes('SSC') || intents.includes('POLICE') || intents.includes('BANKING')) {
                intents = intents.filter(i => i !== 'JOB_SEARCH'); // Specific exam mode is better
            }
            if (intents.includes('ROADMAP') && intents.includes('CAREER_ADVICE')) {
                intents = intents.filter(i => i !== 'CAREER_ADVICE'); // Roadmap covers advice
            }

            return { intents, mood: result?.mood || 'NEUTRAL' };
        } catch (e) {
            return { intents: keywordIntents.length > 0 ? keywordIntents : ['GENERAL'], mood: 'NEUTRAL' };
        }
    }

    static async processUserQuery(userMessage, chatHistory, context) {
        // Multi-modal check
        const { intents, mood } = context.image_url
            ? { intents: ['UTILITY'], mood: 'NEUTRAL' }
            : await this.classifyIntent(userMessage, chatHistory);

        const selectedTools = getToolsByCategory(intents);
        const dynamicSystemPrompt = this._getDynamicPrompt(intents, context.profile || {}, context.isVoice, mood);

        return await AgentLoop.run(userMessage, chatHistory, context, dynamicSystemPrompt, selectedTools, intents);
    }

    static _getDynamicPrompt(intents, profile, isVoice, mood) {
        const isGreeting = intents.includes('GREETING');
        const base = getPersona(profile.name, isGreeting, mood, intents);
        const capabilities = isGreeting ? "" : getModePrompt(intents, profile);
        const format = isGreeting ? "" : getFormatting();

        return `${base}\n\n${capabilities}\n\n${format}`;
    }
}

module.exports = MasterOrchestrator;
