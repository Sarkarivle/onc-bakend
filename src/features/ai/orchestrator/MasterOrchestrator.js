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
        const prompt = `You are a Strict JSON Expert. Output ONLY valid JSON. No markdown backticks, no preamble, no thinking tags.
Classify user intent into ONE of these categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'GENERAL'].

Definitions:
- JOB_SEARCH: Finding active recruitment, forms, or vacancy.
- CAREER_ADVICE: General guidance, roadmap, what to study.

EXAMPLES (STUDY THESE CAREFULLY):
User: "12th ke baad kya karu?" -> {"intent": "CAREER_ADVICE"}
User: "bhai 12th pas ke liye kya koi naya sarkari form nikla h kya" -> {"intent": "JOB_SEARCH"}
User: "police ki bharti kab aayegi" -> {"intent": "JOB_SEARCH"}
User: "BSc karu ya BTech" -> {"intent": "CAREER_ADVICE"}
User: "UP police ka form kaise bharu" -> {"intent": "JOB_SEARCH"}
User: "padhai me man nahi lag raha" -> {"intent": "WELLNESS"}
User: "SSC CGL ka syllabus batao" -> {"intent": "JOB_SEARCH"}
User: "hello bhai" -> {"intent": "GENERAL"}

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
