/**
 * Strict Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Choose response strategy.
Input Query: "${query}"
Intent: ${intent.primaryIntent}

Strategy Rules:
1. If Query is ONLY 1 word (e.g. "naukri", "fees", "age") -> behavior: "CLARIFY".
2. If Intent is GREETING -> mode: "GENERAL_HELP", behavior: "GREET".
3. If Intent is PROFILE_INQUIRY -> mode: "PROFILE_CHECK", behavior: "RESPOND".
4. If Intent is FIELD_CHECK and specific job is known -> mode: "JOB_DETAILS", behavior: "RESPOND".
5. If Intent is FIELD_CHECK but NO specific job is mentioned (e.g. just "fees?") -> mode: "JOB_DETAILS", behavior: "CLARIFY".

Return ONLY JSON:
{
  "thought": "brief",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
