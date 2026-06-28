/**
 * LLMIntentClassifier Module
 * Responsibility: Use a small LLM call to classify intent for ambiguous queries.
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
            Task: Classify user intent for a Job Assistant named Jobo.
            Today is: ${new Date().toDateString()}
            User Message: "${query}"
            Normalized Message: "${context.normalizedMessage || query}"
            Previous Topic: ${context.topic || 'NONE'}
            Last Assistant Action: ${context.lastAssistantAction || 'NONE'}
            Pending Action: ${context.pendingAction || 'NONE'}

            Possible Intents:
            - GREETING: Hello, hi, etc.
            - JOB_QUERY: Looking for jobs, vacancies, work.
            - MORE_RESULTS: Asking for more options, next page.
            - FIELD_DETAILS: Asking for specific info like fees, age, salary, link, etc.
            - APPLICATION_HELP: User wants to fill/apply/register for a form.
            - PROVIDE_QUALIFICATION: User is answering qualification/profile question.
            - EXPLAIN_LAST_FAILURE: User asks why previous data was not found.
            - CAREER_GUIDANCE: Asking what to do after 12th/Graduation, future advice.
            - SCHOLARSHIP: Asking about scholarships, financial aid.
            - RESULT_ADMIT_CARD: Asking for exam results, admit cards.
            - RESUME: Asking for resume help.
            - FOLLOW_UP: Vague message that depends on previous context.
            - GENERAL_QUERY: Anything else.

            Return ONLY a JSON object:
            {
              "primaryIntent": "INTENT_NAME",
              "secondaryIntents": [],
              "communicationAct": "GREETING|QUESTION|FOLLOW_UP|CONFIRMATION|NEGATION",
              "domain": "GOVERNMENT_JOBS|CAREER|RESUME|SCHOLARSHIP|COLLEGE|RESULT|ADMIT_CARD|GENERAL",
              "task": "LATEST|DETAILS|MORE_RESULTS|APPLY_PROCESS|FEE|AGE_LIMIT|ELIGIBILITY|DOWNLOAD|STATUS|EXPLAIN_FAILURE",
              "domainIntent": "GOVT_JOB|CAREER|SCHOLARSHIP|RESUME|COLLEGE|RESULT_ADMIT_CARD|GENERAL|NONE",
              "confidence": 0.0 to 1.0,
              "isFollowUp": true/false,
              "entities": {},
              "needClarification": true/false,
              "dataSourceNeeded": "NONE|DATABASE_FIRST|DATABASE_OR_VERIFIED_SEARCH|PROFILE_AND_LLM|LLM",
              "reason": "Brief reason"
            }
            `;

            const aiRes = await axios.post(url, {
                model: constants.AI_MODEL_NAME,
                prompt: `System: Return ONLY valid JSON. No preamble.\n\nUser: ${prompt}`,
                stream: false,
                options: { temperature: 0.1 }
            }, { timeout: 5000 });

            const rawOutput = aiRes.data.response;
            // Basic cleaning to ensure JSON
            const cleaned = rawOutput.substring(rawOutput.indexOf('{'), rawOutput.lastIndexOf('}') + 1);
            const parsed = JSON.parse(cleaned);
            return {
                primaryIntent: parsed.primaryIntent || 'GENERAL_QUERY',
                secondaryIntents: Array.isArray(parsed.secondaryIntents) ? parsed.secondaryIntents : [],
                communicationAct: parsed.communicationAct,
                domain: parsed.domain,
                task: parsed.task,
                domainIntent: parsed.domainIntent || 'GENERAL',
                confidence: Number(parsed.confidence || 0.5),
                isFollowUp: Boolean(parsed.isFollowUp),
                entities: parsed.entities || {},
                needClarification: Boolean(parsed.needClarification),
                dataSourceNeeded: parsed.dataSourceNeeded,
                reason: parsed.reason || 'LLM classifier fallback'
            };

        } catch (err) {
            console.error('LLM Classification Error:', err.message);
            return { primaryIntent: 'GENERAL_QUERY', domainIntent: 'GENERAL', confidence: 0.5, isFollowUp: false, entities: {}, needClarification: true };
        }
    }
}

module.exports = LLMIntentClassifier;
