/**
 * Strict Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Respond Strategy.
Input: "${query}"
Intent: ${intent.primaryIntent}

STRATEGY RULES:
1. If Query is ONLY 1 word (e.g. "naukri", "fees", "jobs"): behavior MUST be "CLARIFY". DO NOT use "RESPOND".
2. If Intent is GREETING: mode MUST be "GENERAL_HELP", behavior MUST be "GREET".
3. If Intent is PROFILE_INQUIRY: mode MUST be "PROFILE_CHECK", behavior MUST be "RESPOND".

Return ONLY JSON:
{
  "thought": "brief explanation",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
