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
1. "primaryIntent": Identify the core purpose (GREETING, SMALL_TALK, JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, STATUS_CHECK, PROFILE_UPDATE, PROFILE_INQUIRY, DISCOVERY).
    - Use PROFILE_INQUIRY if the user asks about their own data, age, qualification, or status (e.g., "meri age kya hai", "main kitne saal ka hoon", "meri qualification kya hai").
    - Use DISCOVERY if user wants to see "top", "trending", "featured", or "new" things without specific filters.
2. "subIntent": Identify specific details requested (FEES, AGE_LIMIT, SYLLABUS, APPLY_LINK, ADMIT_CARD, NAME_CHANGE, TRENDING).
3. "domain": Categorize the industry (POLICE, RAILWAY, BANK, TEACHING, DEFENCE, MEDICAL, SCHOLARSHIP, GENERAL).
4. "discourse": Determine if this is a "NEW_TOPIC" or a "FOLLOW_UP" based on conversation history.
5. "communicationAct": Categorize the type of message (GREETING, QUESTION, STATEMENT, COMMAND, COMPLAINT, FEEDBACK).
6. "tone": Analyze the user's emotional state (POLITE, URGENT, ANGRY, CASUAL, CONFUSED, FORMAL, CURIOUS, SKEPTICAL).
7. "entities": Extract key parameters like { "job", "location", "qualification", "category", "name" }.
8. "suggestions": Generate 3 most relevant follow-up actions for the user.
9. "reasoning": Explain the semantic logic behind your classification. Why is this specific intent chosen?
10. "confidence": Score your certainty from 0.0 to 1.0.

Deep Intelligence Guidelines:
- SEMANTIC UNDERSTANDING: Do not look for specific keywords. Analyze the "Goal" of the user.
    - "koi top jobs batao" -> Goal: Discover trending opportunities. Intent: DISCOVERY.
    - "naukri hai?" -> Goal: Find employment. Intent: JOB_SEARCH.
    - "fees kitni hai" -> Goal: Factual detail about a specific job. Intent: FIELD_CHECK.
- HINGLISH NUANCE: Be deeply aware of Hinglish syntax, common typos ("nkri"), and regional slang. Interpret them as a native speaker would.
- INTENT CLUSTERING:
    - Queries about fees, last date, age, syllabus, eligibility -> FIELD_CHECK.
    - Queries about finding a job, vacancy, bharti, lists -> JOB_SEARCH or DISCOVERY.
    - Queries about how to prepare, roadmap, life advice, "kaise bane" -> CAREER_ADVICE.
    - Queries about admit card, result, answer key, status -> STATUS_CHECK.
- DISCOVERY VS SEARCH:
    - If the user asks for a specific job (e.g., "SSC GD"), use JOB_SEARCH.
    - If the user asks for general "top", "best", "new", or "any" jobs, use DISCOVERY.
- CLARIFICATION RULE:
    - If the user query is very short (1-2 words like "job", "fees", "exam") and there is NO Active Topic in context, set confidence to 0.4 and suggest clarification in reasoning.
- CONTEXTUAL CONTINUITY: Use the turn count and active topic to resolve ambiguous queries.
- BEHAVIORAL MAPPING:
    - GREETING: "hi", "hello", "kaise ho".
    - SMALL_TALK: "aap kaun ho", "kaise kaam karte ho", "assistant identity".
    - PROFILE_UPDATE: "mera naam X hai", "main 12th pass hoon".

Return ONLY a clean JSON object. No preamble, no postscript.`;
