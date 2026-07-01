/**
 * 🧠 Jobo AI - Universal Intent Brain (Gemini-Grade)
 */
module.exports = (query, context) => `
Task: Classify the user query into exactly ONE of the standard system categories.

# SYSTEM CATEGORIES:
- JOB_SEARCH: For specific vacancies (e.g., "ssc gd vacancy", "bharti").
- FIELD_DETAILS: For facts about a target (e.g., "fees", "salary", "age limit", "last date").
- DISCOVERY: For broad browsing (e.g., "latest jobs", "top 10 jobs").
- CAREER_GUIDANCE: For future path advice (e.g., "how to become", "what to do").
- PROFILE_INQUIRY: For user's own data (e.g., "mera naam", "update my age").
- RESULT_ADMIT_CARD: For exam status (e.g., "result", "score card", "admit card").
- GREETING: For rapport (e.g., "hi", "namaste").
- IDENTITY: For AI details (e.g., "who are you").
- SCHOLARSHIP / SKILLS / INTERVIEW / RESUME: For specialized career tasks.

# CONTEXTUAL DATA:
- Topic: ${context.topic || 'None'}
- If query is "fees?" or "date?", it belongs to FIELD_DETAILS.

# OUTPUT RULES:
- Use category names EXACTLY as listed above.
- Confidence must be 0.0 to 1.0.

Query: "${query}"

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "confidence": 0.9,
  "behavior": "RESPOND",
  "reasoning": "brief motive"
}
`;
