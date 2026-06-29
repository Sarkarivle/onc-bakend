/**
 * LLMIntentClassifier Module (Gemini-Grade Intelligence)
 * Responsibility: Discourse Analysis (New Topic vs Deep Dive vs Action).
 */
const axios = require('axios');
const Settings = require('../settings/settingsModel');
const constants = require('../../config/constants');

class LLMIntentClassifier {
    static async classify(query, context = {}) {
        try {
            const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
            const runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;
            const url = runpodUrl.replace(/\/$/, '') + '/api/generate';

            const prompt = `
            Task: Deeply analyze user intent (Discourse Analysis) for Jobo AI.
            Today is: ${new Date().toDateString()}

            [CONVERSATION CONTEXT]:
            - User Message: "${query}"
            - Last Assistant Message: "${context.lastAssistantResponse || 'NONE'}"
            - Current Topic: "${context.topic || 'GENERAL'}"
            - User Profile: ${JSON.stringify(context.profile || {})}

            Step 1: DISCOURSE ANALYSIS (CRITICAL)
            1. **Is it a NEW_TOPIC?**: Is the user asking for something completely different? (e.g., switched from 'Police' to 'Railway').
            2. **Is it a DEEP_DIVE?**: Is the user asking for specific info (Fees/Age) about the job just mentioned by the Assistant?
            3. **Is it an ACTION (CTA)?**: Does the user want to 'Apply', 'Download', or 'Go to Link'?
            4. **Is it a STATE_CHANGE?**: User confirming, negating, or asking to continue.

            Step 2: EMOTIONAL & IMPLICIT ANALYSIS
            - Detect Emotional Tone: (Frustrated, Urgent, Curious).
            - Detect Implicit Goal: (What they really want vs what they said).

            Step 3: Return JSON:
            {
              "discourseType": "NEW_TOPIC | DEEP_DIVE | ACTION | STATE_CHANGE",
              "reasoning": "Why this discourse type? Link it to Last Assistant Message.",
              "primaryIntent": "INTENT_NAME",
              "communicationAct": "GREETING | QUESTION | FOLLOW_UP | CONFIRMATION",
              "entities": {"jobName": "...", "location": "...", "field": "..."},
              "isFollowUp": true/false,
              "emotionalTone": "...",
              "implicitGoal": "...",
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
                isFollowUp: Boolean(parsed.isFollowUp || parsed.discourseType !== 'NEW_TOPIC'),
                entities: parsed.entities || {},
                confidence: Number(parsed.confidence || 0.5),
                dataSourceNeeded: parsed.dataSourceNeeded || 'LLM_ONLY',
                reasoning: parsed.reasoning
            };

        } catch (err) {
            console.warn('LLM Discourse Analysis Error:', err.message);
            return null;
        }
    }
}

module.exports = LLMIntentClassifier;
