/**
 * Strict Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Respond Strategy.
Input: "${query}"
Intent: ${intent.primaryIntent}

STRATEGY RULES:
1. If Query is ONLY 1 word (e.g. "naukri", "fees", "jobs"): behavior MUST be "CLARIFY".
2. If Intent is GREETING: mode MUST be "GENERAL_HELP", behavior MUST be "GREET".
3. If Intent is PROFILE_INQUIRY: mode MUST be "PROFILE_CHECK", behavior MUST be "RESPOND".
4. If Intent is FIELD_CHECK: mode MUST be "JOB_DETAILS", behavior MUST be "RESPOND".
   (Exception: if it is only 1 word like "fees?", behavior is still "CLARIFY")

Return ONLY JSON:
{
  "thought": "brief explanation",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
