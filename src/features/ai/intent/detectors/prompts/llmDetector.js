/**
 * Prompt for LLM Intent Analysis (Purely Neural Instructions)
 */
module.exports = (query, context) => `
Task: Deep Semantic Intent Analysis for Jobo AI.
User Query: "${query}"

[CONVERSATION CONTEXT]:
- Active Topic: "${context.topic || 'General'}"
- User Profile: ${JSON.stringify(context.profile || {})}
- Conversation Stage: Turn ${context.turnCount || 0}

Analysis Requirements:
1. "primaryIntent": Identify the core purpose (GREETING, JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, STATUS_CHECK, PROFILE_UPDATE).
2. "subIntent": Identify specific details requested (FEES, AGE_LIMIT, SYLLABUS, APPLY_LINK, ADMIT_CARD, NAME_CHANGE).
3. "domain": Categorize the industry (POLICE, RAILWAY, BANK, TEACHING, DEFENCE, MEDICAL, SCHOLARSHIP, GENERAL).
4. "discourse": Determine if this is a "NEW_TOPIC" or a "FOLLOW_UP" based on conversation history.
5. "entities": Extract key parameters like { "job", "location", "qualification", "category", "name" }.
6. "suggestions": Generate 3 most relevant follow-up actions for the user.
7. "reasoning": Explain the semantic logic behind your classification.
8. "confidence": Score your certainty from 0.0 to 1.0.

Deep Intelligence Guidelines:
- SEMANTIC UNDERSTANDING: Do not look for specific words. Analyze the underlying meaning and intent of the user.
- HINGLISH NUANCE: Be deeply aware of Hinglish syntax, common typos, and regional slang. Interpret them as a native speaker would.
- CONTEXTUAL CONTINUITY: Use the turn count and active topic to resolve ambiguous or short queries (e.g., if the user previously asked about a job and now says "fees", link it to that job).
- BEHAVIORAL MAPPING:
    - If the meaning is a greeting or an inquiry about your well-being, use GREETING.
    - If the user provides personal info or introduces themselves, use PROFILE_UPDATE.
    - If the user is looking for employment or vacancies, use JOB_SEARCH.

Return ONLY a clean JSON object. No preamble, no postscript.`;
