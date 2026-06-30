/**
 * Upgraded Planning for Mistral (Preserves Old Logic)
 */
module.exports = (query, intent, context) => `
Task: Choose response strategy for Jobo AI.
Input Query: "${query}"
Detected Intent: ${intent.primaryIntent}

MANDATORY STRATEGY RULES:
1. ONE-WORD RULE: If Query is only 1-2 words (e.g. "naukri", "fees", "jobs") and does not mention a specific job or location, behavior MUST be "CLARIFY".
2. FIELD CHECK RULE: If Intent is "FIELD_CHECK" (user asking for fees, age limit, syllabus), mode MUST be "JOB_DETAILS".
3. GREETING RULE: If Intent is "GREETING", mode MUST be "GENERAL_HELP" and behavior MUST be "GREET".
4. PROFILE RULE: If Intent is "PROFILE_INQUIRY", mode MUST be "PROFILE_CHECK" and behavior MUST be "RESPOND".

Return ONLY JSON:
{
  "thought": "Brief explanation of rule applied",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
