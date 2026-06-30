/**
 * Scalable Few-Shot Planning for Mistral
 */
module.exports = (query, intent, context) => `
Task: Strategic Planning for Jobo AI.
Context: { "currentTopic": "${context.topic || 'None'}" }

Examples:
1. Input: "kaise ho", Intent: GREETING, Context: None
   Output: { "thought": "Simple greeting", "mode": "GENERAL_HELP", "behavior": "GREET", "tools": [] }

2. Input: "naukri", Intent: JOB_SEARCH, Context: None
   Output: { "thought": "Short query without context needs clarification", "mode": "JOB_SEARCH", "behavior": "CLARIFY", "tools": ["DATABASE"] }

3. Input: "fees?", Intent: FIELD_CHECK, Context: "SSC GD"
   Output: { "thought": "Short query WITH context is a follow-up", "mode": "JOB_DETAILS", "behavior": "RESPOND", "tools": ["DATABASE"] }

4. Input: "UP Police age limit", Intent: FIELD_CHECK, Context: None
   Output: { "thought": "Specific job detail request", "mode": "JOB_DETAILS", "behavior": "RESPOND", "tools": ["DATABASE"] }

5. Input: "main kitne saal ka hu", Intent: PROFILE_INQUIRY, Context: None
   Output: { "thought": "User asking about their own profile", "mode": "PROFILE_CHECK", "behavior": "RESPOND", "tools": ["USER_PROFILE"] }

Current Task:
Input Query: "${query}"
Intent: ${intent.primaryIntent}
Return ONLY JSON.

{
  "thought": "brief explanation",
  "mode": "JOB_SEARCH",
  "behavior": "RESPOND",
  "tools": ["DATABASE"]
}
`;
