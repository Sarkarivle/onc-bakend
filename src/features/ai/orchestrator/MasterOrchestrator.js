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
Classify user intent into ONE of these categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].

Definitions:
- JOB_SEARCH: Finding active recruitment, forms, or vacancy.
- CAREER_ADVICE: General guidance, roadmap, what to study.
- DRAFTING: Creating or editing resumes, cover letters, applications, or emails.
- INTERVIEW: Mock interview practice, interview tips, or confidence building.
- NEWS: Latest updates on exams, job trends, or government schemes.
- SOFT_SKILLS: Communication, personality development, English speaking, or office etiquette.
- ROADMAP: Personalized study plans, goal tracking, or long-term career planning.
- ACADEMIC_AUDIT: Analyzing marksheets, scores, or academic history to suggest career paths.
- GRANTS: Searching for scholarships, government schemes, or financial aid.
- SYLLABUS: Breaking down exam syllabus or study material.
- PYQ: Analyzing previous year questions or exam patterns.
- CONCEPT: Explaining academic topics or concepts simply.
- SHORTCUT: Math tricks, reasoning shortcuts, or speed calculation.
- VOCAB: Learning new words, synonyms, or English vocabulary.
- GK_DIGEST: High-impact general knowledge or current affairs for exams.
- TEST_STRATEGY: Improving mock test scores and time management.
- MNEMONIC: Memory tricks, acronyms, or funny stories to remember facts.
- PRACTICAL_SCIENCE: Explaining science concepts using household examples.
- NOTE_NINJA: Teaching smart and short note-taking techniques.
- LINKEDIN: Optimizing LinkedIn profile and networking.
- NETWORKING: Connecting with professionals and mentors.
- NEGOTIATOR: Salary and benefits negotiation.
- PIVOT: Transitioning between different career fields.
- JD_DECODER: Analyzing job descriptions for real requirements.
- EMAIL_PRO: Writing professional emails and messages.
- BODY_LANGUAGE: Personality development and ethical behavior.
- PART_TIME: Finding student-friendly earning opportunities.
- SAVINGS: Budgeting and saving money as a student.
- FEE_WAIVER: Reducing exam or application costs.
- MOTIVATION: Honest and raw motivation to keep going.
- DISTRACTION: Fighting social media addiction and focus issues.
- TIME_BOX: Creating a study routine or time table.
- HABIT: Building discipline and positive routines.
- PROCRASTINATION: Overcoming the habit of delaying tasks.
- CODING: Learning to code from scratch.
- AI_LITERACY: Using AI tools for study and work.
- DATA_SKILLS: Learning Excel and data management.
- CYBER_SAFETY: Staying safe online and avoiding scams.
- CREATOR: Starting as a YouTuber or content creator.
- SSC: Specific guidance for SSC exams (CGL, CHSL, etc.).
- POLICE: Preparation for state police exams.
- RAILWAY: Preparation for RRB and Railway exams.
- BANKING: Preparation for IBPS, SBI, and bank exams.
- TEACHER: Preparation for teaching exams like CTET/TET.
- UPSC: Foundation and roadmap for civil services.
- ENGLISH_PRACTICE: 1-on-1 English speaking practice.
- STAGE_CONFIDENCE: Overcoming public speaking fear.
- GD_MASTER: Group Discussion strategy and leadership.
- BACKUP_PLAN: Creating a Plan B for career safety.
- LOCAL_SCOUT: Finding local city-specific opportunities.
- TREND_PREDICTOR: Job market future trends and AI impact.
- STARTUP: Guidance on starting a small business or startup.
- HIGHER_STUDIES: Roadmap for Masters/PhD in India or abroad.
- STUDENT_RIGHTS: Legal rights, anti-ragging, and student laws.
- SCAM_PROTECTOR: Identifying and avoiding job scams.
- RTI_HELPER: How to file RTI for exam info.
- FORM_GUARD: Avoiding errors in exam/job applications.
- RURAL_EMPOWER: Opportunities for rural/village students.

EXAMPLES (STUDY THESE CAREFULLY):
User: "english bolne ki practice karni hai" -> {"intent": "ENGLISH_PRACTICE"}
User: "agar ssc nahi nikla toh kya karu?" -> {"intent": "BACKUP_PLAN"}
User: "stage par bolne me dar lagta hai" -> {"intent": "STAGE_CONFIDENCE"}
User: "gd me kaise baithte hain?" -> {"intent": "GD_MASTER"}
User: "rti kaise lagate hain?" -> {"intent": "RTI_HELPER"}
User: "rural students ke liye koi scheme hai?" -> {"intent": "RURAL_EMPOWER"}
User: "fake job offers se kaise bache?" -> {"intent": "SCAM_PROTECTOR"}
User: "upsc ka syllabus samjha de" -> {"intent": "UPSC"}
User: "coding kaha se shuru karu?" -> {"intent": "CODING"}
User: "padhai me mann nahi lag raha" -> {"intent": "MOTIVATION"}
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

# GEMINI-PRO LEVEL REASONING: INTERNAL THINKING PROCESS
Before providing the final response, you MUST complete these steps internally (do not show them to the user):
1. **DEEP ANALYSIS:** What is the user's ultimate goal? Is it selection, information, or motivation?
2. **CONTEXT SYNTHESIS:** Link the query to their profile (${profile.qualification || "Unknown"}, ${profile.location || "Unknown"}).
3. **STRATEGIC PIVOT:** If the tool output is empty or weak, pivot to the "Bhai Ki Strategic Tip" immediately.
4. **COGNITIVE LOAD CHECK:** Is the response structured for 'Visual Calm'? Use bolding and emojis sparingly but effectively.

# SOVEREIGN STRATEGIST: AUTONOMOUS GOAL PLANNING
- If the user discusses a career path, automatically propose a **6-Month North Star Goal**.
- **Predictive Failure Guard:** If the user mentions a habit (e.g., skipping subjects), warn them immediately.
- **Scam Mitigation:** If the query involves suspicious "Work from Home" or "Pay for Job" offers, flag it as a **RED ALERT**.

# AUTHORITATIVE EXPERT TONE
Do not be a passive assistant. Be a **Strategic Partner**. If a user's plan is weak, say it directly but with brotherly love, and provide a better strategy.`;

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
