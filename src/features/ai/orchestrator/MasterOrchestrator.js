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
            return 'GENERAL';
        }

        // --- STEP 2: LEAN CLASSIFICATION (Save 80% tokens) ---
        // We remove definitions and keep only category list + high-impact examples.
        const prompt = `You are a Strict JSON Expert. Classify user intent into ONE category.
Categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].

EXAMPLES:
- "english bolne ki practice" -> {"intent": "ENGLISH_PRACTICE"}
- "ssc nahi nikla toh kya karu" -> {"intent": "BACKUP_PLAN"}
- "stage fear kaise nikale" -> {"intent": "STAGE_CONFIDENCE"}
- "rti kaise lagate hain" -> {"intent": "RTI_HELPER"}
- "upsc syllabus samjha de" -> {"intent": "UPSC"}
- "coding kaha se shuru karu" -> {"intent": "CODING"}
- "padhai me mann nahi lag raha" -> {"intent": "MOTIVATION"}
- "police bharti kab aayegi" -> {"intent": "JOB_SEARCH"}
- "BSc karu ya BTech" -> {"intent": "CAREER_ADVICE"}
- "resume check kar le" -> {"intent": "DRAFTING"}
- "mock interview practice" -> {"intent": "INTERVIEW"}

User: "${userQuery}"
Output ONLY JSON: {"intent": "CATEGORY"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            return result?.intent || 'GENERAL';
        } catch (e) {
            console.error("❌ Supervisor Classification failed:", e.message);
            return 'GENERAL';
        }
    }

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
        let intent = 'GENERAL';
        let finalQuery = userQuery;

        console.log("🛠️ MasterOrchestrator: Processing context image_url:", context.image_url ? `${context.image_url.substring(0, 50)}...` : "NONE");

        // If image exists, we append a hidden instruction to the query for the AgentLoop
        if (context.image_url) {
            console.log("📸 MasterOrchestrator: Image detected, prioritizing Vision Analysis.");
            intent = 'UTILITY';

            // Point 17: Multimodal Career Critique
            finalQuery = `${userQuery}\n\n(Bhai, user ne ek image bheji hai. Is image ko analyze karke user ke sawal ka jawab do. Agar ye Resume ya Marksheet hai, toh Point 17 follow kar ke "Expert Critique" dena—kamiyan batao aur improvements suggest karo. Agar normal document hai, toh sirf scan karke info do. Agar jarurat ho toh analyze_image tool ka use karo.)`;
        } else {
            intent = await this.classifyIntent(userQuery);
        }

        const selectedTools = getToolsByCategory(intent);
        const dynamicSystemPrompt = this._getDynamicPrompt(intent, context.profile || {}, context.isVoice);

        console.log(`🤖 Supervisor: Intent [${intent}] | Query: ${finalQuery.substring(0, 100)}...`);

        return await AgentLoop.run(finalQuery, chatHistory, context, dynamicSystemPrompt, selectedTools, intent);
    }

    /**
     * Constructs a specialized system prompt based on the detected intent using the modular prompt library.
     * Incorporates Phase 1 & 5: Intellectual Core + Sovereign Strategist.
     */
    static _getDynamicPrompt(intent, profile, isVoice = false) {
        const base = getPersona(profile.name);
        const mode = getModePrompt(intent);
        const format = getFormatting();

        let prompt = `${base}\n${mode}\n${format}

# INTERNAL THINKING (CHAIN OF THOUGHT)
1. **Analyze:** Goal? (Selection/Info/Motivation)
2. **Context:** Profile (${profile.qualification || "Graduate"}, ${profile.location || "India"}).
3. **Strategic Pivot:** If tools are empty, use "Bhai Ki Strategic Tip".
4. **Visual Calm:** Keep paragraphs < 3 lines. Use bolding for facts only.

# SOVEREIGN STRATEGIST
- Career Path -> Propose **6-Month North Star Goal**.
- Bad Habit -> **Predictive Failure Guard** alert.
- Scam Risk -> **RED ALERT** flag.

# TONE
Be an **Authoritative Strategic Partner**. If a plan is weak, tell it with brotherly love and provide a better one.`;

        if (isVoice) {
            prompt += `\n\n# VOICE MODE CRITICAL:
- Be extremely "TO THE POINT".
- Maximum 2 short sentences.
- No markdown, no bolding, no bullets (it will be read aloud).
- No fluff, no extra talk. Just answer directly.`;
        }

        return prompt;
    }
}

module.exports = MasterOrchestrator;
