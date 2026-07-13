/**
 * MasterOrchestrator (The Supervisor)
 * Responsibility: Intent Classification and Dynamic Worker Configuration.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getFormatting, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    static async classifyIntent(userQuery) {
        const lowerQuery = userQuery.toLowerCase().trim();

        // Advanced Greeting Detection (Regex for Hinglish greetings)
        const greetingPattern = /^(hi|hello|hey|hlo|hii|namaste|ram ram|kaise ho|ji|bhai|jobo|good morning|gm|gn|good night)/i;

        if (greetingPattern.test(lowerQuery) && lowerQuery.split(' ').length <= 6) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        if (lowerQuery.length < 3) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        const prompt = `You are a Strict JSON Expert. Analyze user query for relevant Intents and Mood.
Valid Categories: ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].
Moods: ['STRESSED', 'CONFUSED', 'DETERMINED', 'URGENT', 'NEUTRAL'].

Instruction: Select ONLY the 1-3 most relevant and specific categories. Do NOT return the entire list.
User Query: "${userQuery}"
Output ONLY JSON: {"intents": ["CAT1", "CAT2"], "mood": "MOOD"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);

            // Intelligence Patch: Force ROADMAP if user asks "how to", "plan", or "what to do"
            const q = lowerQuery;
            if (q.includes('kya kare') || q.includes('kaise kare') || q.includes('taiari') || q.includes('plan') || q.includes('roadmap') || q.includes('strategy')) {
                if (result.intents && !result.intents.includes('ROADMAP')) {
                    result.intents.push('ROADMAP');
                }
            }

            // Safety filter: ensure only valid intents are returned
            const validIntents = (result?.intents || ['GENERAL']).filter(i =>
                ['JOB_SEARCH', 'CAREER_ADVICE', 'MATH', 'WELLNESS', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'NEWS', 'SOFT_SKILLS', 'ROADMAP', 'ACADEMIC_AUDIT', 'GRANTS', 'SYLLABUS', 'PYQ', 'CONCEPT', 'SHORTCUT', 'VOCAB', 'GK_DIGEST', 'TEST_STRATEGY', 'MNEMONIC', 'PRACTICAL_SCIENCE', 'NOTE_NINJA', 'LINKEDIN', 'NETWORKING', 'NEGOTIATOR', 'PIVOT', 'JD_DECODER', 'EMAIL_PRO', 'BODY_LANGUAGE', 'PART_TIME', 'SAVINGS', 'FEE_WAIVER', 'MOTIVATION', 'DISTRACTION', 'TIME_BOX', 'HABIT', 'PROCRASTINATION', 'CODING', 'AI_LITERACY', 'DATA_SKILLS', 'CYBER_SAFETY', 'CREATOR', 'SSC', 'POLICE', 'RAILWAY', 'BANKING', 'TEACHER', 'UPSC', 'ENGLISH_PRACTICE', 'STAGE_CONFIDENCE', 'GD_MASTER', 'BACKUP_PLAN', 'LOCAL_SCOUT', 'TREND_PREDICTOR', 'STARTUP', 'HIGHER_STUDIES', 'STUDENT_RIGHTS', 'SCAM_PROTECTOR', 'RTI_HELPER', 'FORM_GUARD', 'RURAL_EMPOWER', 'GENERAL'].includes(i)
            );
            return {
                intents: validIntents.length > 0 ? validIntents : ['GENERAL'],
                mood: result?.mood || 'NEUTRAL'
            };
        } catch (e) {
            return { intents: ['GENERAL'], mood: 'NEUTRAL' };
        }
    }

    static async processUserQuery(userQuery, chatHistory, context) {
        let intents = ['GENERAL'];
        let mood = 'NEUTRAL';
        let finalQuery = userQuery;

        if (context.image_url) {
            intents = ['UTILITY'];
            finalQuery = `${userQuery}\n\n(Bhai, user ne ek image bheji hai. Analyze it directly.)`;
        } else {
            const classification = await this.classifyIntent(userQuery);
            intents = classification.intents;
            mood = classification.mood;

            // GEMINI 3 DYNAMIC PATCH: Filter redundant intents to save tokens
            if (intents.includes('ROADMAP') && intents.includes('CAREER_ADVICE')) {
                intents = intents.filter(i => i !== 'CAREER_ADVICE'); // Roadmap covers it
            }
        }

        const selectedTools = getToolsByCategory(intents);
        const dynamicSystemPrompt = this._getDynamicPrompt(intents, context.profile || {}, context.isVoice, mood);

        return await AgentLoop.run(finalQuery, chatHistory, context, dynamicSystemPrompt, selectedTools, intents);
    }

    static _getDynamicPrompt(intents, profile, isVoice = false, mood = 'NEUTRAL') {
        const isGreeting = intents.includes('GREETING');
        const base = getPersona(profile.name, isGreeting, mood, intents);
        const format = isGreeting ? "" : getFormatting();
        const capabilities = isGreeting ? "" : getModePrompt(intents, profile);

        const moodMap = {
            'STRESSED': "\n# MOOD: STRESSED (Calm & Reassuring)",
            'CONFUSED': "\n# MOOD: CONFUSED (Simple ELI5 steps)",
            'DETERMINED': "\n# MOOD: DETERMINED (High Energy)",
            'URGENT': "\n# MOOD: URGENT (Fast & Direct)",
            'NEUTRAL': ""
        };

        return `${base}${moodMap[mood] || ""}\n\n${capabilities}\n\n${format}`;
    }
}

module.exports = MasterOrchestrator;
