/**
 * LLMIntentClassifier Module (Super-Power Version)
 * Responsibility: Deep Discourse Analysis with Few-Shot Examples & Self-Correction.
 */
const axios = require('axios');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');

class LLMIntentClassifier {
    static async classify(query, context = {}) {
        try {
            const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
            let baseUrl = runpodSetting?.value || constants.DEFAULT_RUNPOD_URL;

            // Clean URL and switch to /api/generate for this specific call
            baseUrl = baseUrl.replace(/\/api\/chat\/?$/, '').replace(/\/$/, '');
            const url = `${baseUrl}/api/generate`;

            const prompt = `
            Task: Enterprise-grade Intent Classification for Jobo AI.
            Role: You are the "Brain" of the system. Accuracy is everything.
            Today is: ${new Date().toDateString()}

            [CONVERSATION HISTORY CONTEXT]:
            - User: "${query}"
            - Last Assistant Message: "${context.lastAssistantResponse || 'NONE'}"
            - Current Topic: "${context.topic || 'GENERAL'}"
            - User Profile: ${JSON.stringify(context.profile || {})}

            ### EXAMPLES FOR LEARNING (FEW-SHOT):
            1. User: "Iski fees kya hai?" -> Discourse: DEEP_DIVE, Reasoning: User is asking about the job just mentioned.
            2. User: "Railway ki batao" -> Discourse: NEW_TOPIC, Reasoning: User switched from previous topic to Railway.
            3. User: "Theek hai" -> Discourse: STATE_CHANGE, Reasoning: User is confirming or acknowledging.
            4. User: "Apply link" -> Discourse: ACTION, Reasoning: User wants to perform a CTA.

            ### STEP 1: DEEP REASONING
            1. **Discourse Check**: Is this a continuation (DEEP_DIVE) or a pivot (NEW_TOPIC)?
            2. **Implicit Need**: If user says "SSC" and it's March, are they likely asking for results?
            3. **Entity Extraction**: Extract location, job name, qualification, etc.
            4. **Constraint Detection**: Did the user say "short", "no table", or "only link"?

            ### STEP 2: SELF-REFLECTION (CRITICAL)
            - Double check: "Does my reasoning match the last message?"
            - If I am 100% sure, return JSON.

            Return JSON:
            {
              "discourseType": "NEW_TOPIC | DEEP_DIVE | ACTION | STATE_CHANGE",
              "reasoning": "Explain WHY this is the intent.",
              "primaryIntent": "INTENT_NAME",
              "communicationAct": "GREETING | QUESTION | FOLLOW_UP | CONFIRMATION",
              "entities": {},
              "emotionalTone": "NEUTRAL | FRUSTRATED | URGENT",
              "implicitGoal": "What they really want",
              "userConstraints": [],
              "confidence": 0.0 to 1.0,
              "dataSourceNeeded": "DATABASE_FIRST | SEARCH_FIRST | LLM_ONLY"
            }
            `;

            const aiRes = await axios.post(url, {
                model: constants.AI_MODEL_NAME,
                prompt: `System: Return ONLY valid JSON. No preamble.\n\nUser: ${prompt}`,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 4000 });

            const rawOutput = aiRes.data.response;
            const cleaned = rawOutput.substring(rawOutput.indexOf('{'), rawOutput.lastIndexOf('}') + 1);
            const parsed = JSON.parse(cleaned);

            return {
                discourseType: parsed.discourseType || 'NEW_TOPIC',
                primaryIntent: parsed.primaryIntent || 'GENERAL_QUERY',
                communicationAct: parsed.communicationAct || 'QUESTION',
                emotionalTone: parsed.emotionalTone || 'NEUTRAL',
                implicitGoal: parsed.implicitGoal || '',
                userConstraints: parsed.userConstraints || [],
                isFollowUp: Boolean(parsed.discourseType !== 'NEW_TOPIC'),
                entities: parsed.entities || {},
                confidence: Number(parsed.confidence || 0.5),
                dataSourceNeeded: parsed.dataSourceNeeded || 'LLM_ONLY',
                reasoning: parsed.reasoning
            };

        } catch (err) {
            console.warn('LLM Super-Classifier Error:', err.message);
            return null;
        }
    }
}

module.exports = LLMIntentClassifier;
