/**
 * Strict Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Respond Strategy.
Input: "${query}"
Intent: ${intent.primaryIntent}

STRATEGY RULES:
1. If Query is ONLY 1 word (e.g. "naukri", "fees") -> behavior: "CLARIFY".
2. If Intent is DISCOVERY -> mode: "JOB_SEARCH", behavior: "RESPOND".
3. If Intent is PROFILE_INQUIRY -> mode: "PROFILE_CHECK", behavior: "RESPOND".

Return ONLY JSON:
{
  "thought": "brief explanation",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
