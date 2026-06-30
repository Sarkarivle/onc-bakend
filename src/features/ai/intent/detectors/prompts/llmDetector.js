/**
 * Prompt for LLM Intent Analysis
 * Filename matches the logic file: detectors/llmDetector.js
 */
module.exports = (query, context) => `
Task: Neural Intent Analysis for Jobo AI.
User Query: "${query}"

[CONTEXT]:
- Last Topic: "${context.topic || 'None'}"
- User Profile: ${JSON.stringify(context.profile || {})}
- Turn Count: ${context.turnCount || 0}

Analyze the query and return ONLY a JSON object with these fields:
1. "primaryIntent": (e.g., JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, STATUS_CHECK, GREETING, PROFILE_UPDATE)
2. "subIntent": (e.g., FEES, AGE_LIMIT, SYLLABUS, APPLY_LINK, ADMIT_CARD, NAME_CHANGE, QUALIFICATION_UPDATE)
3. "domain": (e.g., POLICE, RAILWAY, BANK, TEACHING, DEFENCE, MEDICAL, SCHOLARSHIP, GENERAL)
4. "discourse": "NEW_TOPIC" or "FOLLOW_UP"
5. "entities": { "job": string, "location": string, "qualification": string, "category": string, "name": string }
6. "suggestions": ["Chip Text 1", "Chip Text 2", "Chip Text 3"] (Contextual follow-up options for the user)
7. "reasoning": "Short explanation of why you chose this intent"
8. "confidence": 0.0 to 1.0

Rules:
- If user asks "fees" for a previous job, discourse is FOLLOW_UP.
- If user mentions a new job, discourse is NEW_TOPIC.
- If user introduces themselves or gives personal info, use PROFILE_UPDATE.
- Be Hinglish aware. "bharti" means job, "paisa" means fees/salary.

Return ONLY JSON. No preamble.`;
