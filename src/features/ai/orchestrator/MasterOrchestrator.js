/**
 * MasterOrchestrator (The Supervisor)
 * Responsibility: Intent Classification and Dynamic Worker Configuration.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getFormatting, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    /**
     * Classifies user intent into a specific category to optimize tool injection.
     */
    static async classifyIntent(userQuery) {
        const prompt = `Classify user intent into ONE of these categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'GENERAL'].

- JOB_SEARCH: (CRITICAL RULE) Select this if the user asks for "forms", "vacancy", "bharti", "latest jobs", or active recruitment. Always use this when the user wants to apply for something right now.
- CAREER_ADVICE: Select this ONLY if the user asks for guidance on what to study next, which degree is better, or how to become something (e.g., "BTech karu ya BSc", "IAS kaise banu"). Do NOT use this if they are asking about current form openings.
- MATH: Percentages, mark calculations, or simple arithmetic.
- WELLNESS: Stress, motivation, or emotional support.
- UTILITY: Search the web, OCR from images, time, or profile updates.
- GENERAL: Greetings, identity questions, or casual conversation.

User Query: "${userQuery}"

Output ONLY valid JSON: {"intent": "CATEGORY"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            return result?.intent || 'GENERAL';
        } catch (e) {
            console.error("❌ Supervisor Classification failed:", e.message);
            return 'GENERAL';
        }
    }

    /**
     * Entry point for processing user queries in the Supervisor-Worker architecture.
     */
    static async processUserQuery(userQuery, chatHistory, context) {
        const intent = await this.classifyIntent(userQuery);

        // JOB_SEARCH uses specific job tools, CAREER_ADVICE relies on LLM knowledge for now.
        const selectedTools = getToolsByCategory(intent);
        const dynamicSystemPrompt = this._getDynamicPrompt(intent, context.profile || {});

        console.log(`🤖 Supervisor: Intent [${intent}] | Injecting [${selectedTools.length}] tools.`);

        return await AgentLoop.run(userQuery, chatHistory, context, dynamicSystemPrompt, selectedTools, intent);
    }

    /**
     * Constructs a specialized system prompt based on the detected intent using the modular prompt library.
     */
    static _getDynamicPrompt(intent, profile) {
        const base = getPersona(profile.name);
        const mode = getModePrompt(intent);
        const format = getFormatting();

        return `${base}\n${mode}\n${format}`;
    }
}

module.exports = MasterOrchestrator;
