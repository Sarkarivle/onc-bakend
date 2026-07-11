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
        const lowerQuery = userQuery.toLowerCase().trim();
        const greetings = ['hi', 'hello', 'hey', 'bhai', 'namaste', 'ji', 'ram ram', 'hlo', 'hii'];
        if (greetings.includes(lowerQuery) || lowerQuery.length < 3) {
            return { intents: ['GENERAL'], mood: 'NEUTRAL' };
        }

        const prompt = `You are a Strict JSON Expert. Analyze user query for Intent and Mood.
Categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].
Moods: ['STRESSED', 'CONFUSED', 'DETERMINED', 'URGENT', 'NEUTRAL'].

User Query: "${userQuery}"
Output ONLY JSON: {"intents": ["CAT1"], "mood": "MOOD"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            return {
                intents: result?.intents || ['GENERAL'],
                mood: result?.mood || 'NEUTRAL'
            };
        } catch (e) {
            console.error("❌ Supervisor Classification failed:", e.message);
            return { intents: ['GENERAL'], mood: 'NEUTRAL' };
        }
    }

    /**
     * Entry point for processing user queries.
     */
    static async processUserQuery(userQuery, chatHistory, context) {
        let intents = ['GENERAL'];
        let mood = 'NEUTRAL';
        let finalQuery = userQuery;

        if (context.image_url) {
            intents = ['UTILITY'];
            finalQuery = `${userQuery}\n\n(Bhai, user ne ek image bheji hai. Is image ko analyze karke user ke sawal ka jawab do. Agar ye Resume ya Marksheet hai, toh iska "Expert Critique" dena. Agar normal document hai, toh sirf scan karke info do.)`;
        } else {
            const classification = await this.classifyIntent(userQuery);
            intents = classification.intents;
            mood = classification.mood;
        }

        const selectedTools = getToolsByCategory(intents);
        const dynamicSystemPrompt = this._getDynamicPrompt(intents, context.profile || {}, context.isVoice, mood);

        console.log(`🤖 Supervisor: Intents [${intents.join(', ')}] | Mood: ${mood}`);

        return await AgentLoop.run(finalQuery, chatHistory, context, dynamicSystemPrompt, selectedTools, intents[0]);
    }

    /**
     * Constructs a specialized system prompt.
     */
    static _getDynamicPrompt(intents, profile, isVoice = false, mood = 'NEUTRAL') {
        const base = getPersona(profile.name);
        const format = getFormatting();
        const capabilityIndex = getModePrompt(intents);

        const moodInstructions = {
            'STRESSED': "\n# MOOD: STRESSED (Be calming and empathetic)",
            'CONFUSED': "\n# MOOD: CONFUSED (Explain like I'm 5)",
            'DETERMINED': "\n# MOOD: DETERMINED (Match their high energy)",
            'URGENT': "\n# MOOD: URGENT (Skip the fluff, be direct)",
            'NEUTRAL': ""
        };

        let prompt = `${base}${moodInstructions[mood] || ""}\n\n${capabilityIndex}\n\n${format}

# DYNAMIC INTELLIGENCE PROTOCOL
1. **Persona First:** You are Jobo, the Bada Bhai.
2. **Visual Calm:** Use Tables for comparisons and Lists for steps.
3. **Strategic Insight:** Always end with an "Actionable Next Step".`;

        if (isVoice) {
            prompt += `\n\n# VOICE MODE CRITICAL:
- Be extremely "TO THE POINT".
- Maximum 2 short sentences.
- No markdown, no fluff. Just direct answer.`;
        }

        return prompt;
    }
}

module.exports = MasterOrchestrator;
