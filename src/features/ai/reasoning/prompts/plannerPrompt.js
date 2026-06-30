/**
 * Refined Prompt for Mistral Agentic Planning
 */
module.exports = (query, intent, context) => `
Task: Strategic Planning for Jobo AI.
Input Query: "${query}"
Intent: ${intent.primaryIntent}

Rules:
1. AMBIGUITY: If query is only 1 word (e.g., "naukri", "job", "fees") without any context, behavior MUST be "CLARIFY".
2. PROFILE: If intent is "PROFILE_INQUIRY", mode MUST be "PROFILE_CHECK" and tool "USER_PROFILE".
3. JOB: If asking for vacancies, mode is "JOB_SEARCH". If asking for fees/age, mode is "JOB_DETAILS".

Return ONLY this JSON format:
{
  "thought": "Strategy explanation",
  "mode": "JOB_SEARCH/JOB_DETAILS/PROFILE_CHECK/GENERAL_HELP",
  "behavior": "RESPOND/CLARIFY/GREET",
  "tools": ["DATABASE", "USER_PROFILE", "WEB_SEARCH"]
}
`;
