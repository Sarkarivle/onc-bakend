/**
 * Strict Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Respond Strategy.
Input: "${query}"
Intent: ${intent.primaryIntent}

Rules:
1. If Query is ONLY 1-2 words (e.g. "naukri", "fees", "age") and no context: behavior MUST be "CLARIFY".
2. If Intent is PROFILE_INQUIRY: mode MUST be "PROFILE_CHECK", behavior "RESPOND", tool "USER_PROFILE".
3. If Intent is GREETING: mode MUST be "GENERAL_HELP", behavior "GREET", no tools.

Return ONLY JSON (Choose exactly one mode, no backslashes):
{
  "thought": "brief",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
