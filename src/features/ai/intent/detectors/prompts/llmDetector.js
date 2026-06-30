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
1. "primaryIntent": Identify core purpose (GREETING, SMALL_TALK, JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, STATUS_CHECK, PROFILE_UPDATE, PROFILE_INQUIRY, DISCOVERY).
    - PROFILE_INQUIRY: User asks about THEIR data (age, name, status).
    - FIELD_CHECK: User asks about JOB RULES (fees, age limit, syllabus).
2. "subIntent": (FEES, AGE_LIMIT, SYLLABUS, APPLY_LINK, ADMIT_CARD, TRENDING).
3. "domain": (POLICE, RAILWAY, BANK, TEACHING, DEFENCE, MEDICAL, GENERAL).
4. "discourse": ("NEW_TOPIC", "FOLLOW_UP").
5. "communicationAct": (GREETING, QUESTION, STATEMENT, COMMAND, COMPLAINT).
6. "tone": (POLITE, URGENT, ANGRY, CASUAL, CONFUSED, CURIOUS).
7. "entities": { "job", "location", "qualification", "category" }.
8. "suggestions": 3 follow-up actions.
9. "reasoning": Explain why this intent was chosen.
10. "confidence": Certainty score (0.0 to 1.0).

Deep Intelligence Guidelines:
- SEMANTIC OVER KEYWORDS: Focus on the "Goal". "Naukri?" -> JOB_SEARCH. "Meri age?" -> PROFILE_INQUIRY.
- FIELD VS PROFILE: "UP Police age limit" is FIELD_CHECK. "Main 25 ka hoon, eligible hoon?" is JOB_SEARCH.
- DISCOVERY: "Top jobs", "Trending jobs", "latest jobs" -> DISCOVERY.
- GREETING: "hi", "hello", "kaise ho".
- SMALL_TALK: "aap kaun ho", "identity".
- CONTEXTUAL CONTINUITY: Use the turn count and active topic to resolve ambiguous queries.
- BEHAVIORAL MAPPING:
    - GREETING: "hi", "hello", "kaise ho".
    - SMALL_TALK: "aap kaun ho", "kaise kaam karte ho", "assistant identity".
    - PROFILE_UPDATE: "mera naam X hai", "main 12th pass hoon".

Return ONLY a clean JSON object. No preamble, no postscript.`;
