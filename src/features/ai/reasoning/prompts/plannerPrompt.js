/**
 * Prompt for AgenticPlanner Task (Base Model Optimized)
 */
module.exports = (query, intent, context) => `
Task: Plan the internal strategy for Jobo AI.
User Query: "${query}"
Detected Intent: ${intent.primaryIntent}

Modes:
- JOB_SEARCH: For finding vacancies.
- JOB_DETAILS: For specific job rules (fees, age).
- PROFILE_CHECK: For user data inquiry.
- GENERAL_HELP: For greetings and small talk.

Return ONLY this JSON format:
{
  "thought": "Strategy explanation",
  "mode": "MODE_NAME",
  "behavior": "RESPOND/CLARIFY/GREET",
  "tools": ["DATABASE", "USER_PROFILE", etc]
}
`;
