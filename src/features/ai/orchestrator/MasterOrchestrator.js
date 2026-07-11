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
        // --- STEP 1: FAST BYPASS (Save 100% tokens for simple greetings) ---
        const lowerQuery = userQuery.toLowerCase().trim();
        const greetings = ['hi', 'hello', 'hey', 'bhai', 'namaste', 'ji', 'ram ram', 'hlo', 'hii'];
        if (greetings.includes(lowerQuery) || lowerQuery.length < 3) {
            return { intents: ['GENERAL'], mood: 'NEUTRAL' };
        }

        // --- STEP 2: DYNAMIC INTENT & MOOD ASSEMBLY (Gemini-Pro Standard) ---
        const prompt = `You are a Strict JSON Expert. Analyze user query for Intent and Mood.
Categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].
Moods: ['STRESSED', 'CONFUSED', 'DETERMINED', 'URGENT', 'NEUTRAL'].

EXAMPLES:
- "exam se darr lag raha h" -> {"intents": ["WELLNESS"], "mood": "STRESSED"}
- "ssc syllabus samjha de jaldi" -> {"intents": ["SYLLABUS"], "mood": "URGENT"}
- "bhai phod dena h is baar" -> {"intents": ["MOTIVATION"], "mood": "DETERMINED"}

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
     * Entry point for processing user queries in the Supervisor-Worker architecture.
     */
    static async processUserQuery(userQuery, chatHistory, context) {
        let intents = ['GENERAL'];
        let mood = 'NEUTRAL';
        let finalQuery = userQuery;

        console.log("🛠️ MasterOrchestrator: Processing context image_url:", context.image_url ? `${context.image_url.substring(0, 50)}...` : "NONE");

        // If image exists, we append a hidden instruction to the query for the AgentLoop
        if (context.image_url) {
            console.log("📸 MasterOrchestrator: Image detected, prioritizing Vision Analysis.");
            intents = ['UTILITY'];
            finalQuery = `${userQuery}\n\n(Bhai, user ne ek image bheji hai. Is image ko analyze karke user ke sawal ka jawab do. Agar ye Resume ya Marksheet hai, toh Point 17 follow kar ke "Expert Critique" dena—kamiyan batao aur improvements suggest karo. Agar normal document hai, toh sirf scan karke info do. Agar jarurat ho toh analyze_image tool ka use karo.)`;
        } else {
            const classification = await this.classifyIntent(userQuery);
            intents = classification.intents;
            mood = classification.mood;
        }

        const selectedTools = getToolsByCategory(intents);
        const dynamicSystemPrompt = this._getDynamicPrompt(intents, context.profile || {}, context.isVoice, mood);

        console.log(`🤖 Supervisor: Intents [${intents.join(', ')}] | Mood: ${mood} | Query: ${finalQuery.substring(0, 100)}...`);

        return await AgentLoop.run(finalQuery, chatHistory, context, dynamicSystemPrompt, selectedTools, intents[0]);
    }

    /**
     * Constructs a specialized system prompt based on the detected intent using the modular prompt library.
     * Transitioned to Architectural Version 4.0: Capability-based Fluid Intelligence.
     */
    static _getDynamicPrompt(intents, profile, isVoice = false, mood = 'NEUTRAL') {
        const base = getPersona(profile.name);
        const format = getFormatting();
        const capabilityIndex = getModePrompt(intents); // Now returns a condensed Capability Index

        const moodInstructions = {
            'STRESSED': "\n# MOOD: STRESSED (Calm & Empathetic mode active)",
            'CONFUSED': "\n# MOOD: CONFUSED (Simplicity & ELI5 mode active)",
            'DETERMINED': "\n# MOOD: DETERMINED (High-Octane Motivation active)",
            'URGENT': "\n# MOOD: URGENT (Direct & Fast mode active)",
            'NEUTRAL': ""
        };

        let prompt = `${base}${moodInstructions[mood] || ""}\n\n${capabilityIndex}\n\n${format}

# DYNAMIC INTELLIGENCE PROTOCOL (GEMINI-STYLE)
1. **Persona First:** You are Jobo. Don't act like a bot. Act like a mentor with a brain.
2. **Emergent Reasoning:** Use the tools provided only when needed. If you have the answer in your knowledge base and it's general, provide it. If it's specific (Job/Math), use the tool.
3. **Structural Freedom:** You decide the best way to present information. If it needs a table, make one. If it needs a roadmap, draw it with text.
4. **Visual Calm:** Keep it clean. Bold facts. Short paragraphs.

# TONE: AUTHORITATIVE STRATEGIC PARTNER
- If a user's plan is weak, challenge it.
- If they are eligible for better things, show them the way.
- Use "Bhai Ki Strategic Tip" to add value that a normal search wouldn't provide.`;

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
