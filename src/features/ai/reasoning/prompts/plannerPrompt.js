/**
 * Prompt for AgenticPlanner Task
 */
module.exports = (query, intent, context) => `### Instruction:
Plan the response strategy for a job assistant.
Input Query: "${query}"
Detected Intent: ${intent.primaryIntent}

Return ONLY a JSON object with these keys:
"thought": string,
"mode": "JOB_SEARCH" | "JOB_DETAILS" | "CAREER_GUIDANCE" | "GENERAL_HELP" | "PROFILE_CHECK",
"behavior": "RESPOND" | "CLARIFY" | "GREET",
"tools": ["DATABASE" | "WEB_SEARCH" | "USER_PROFILE"]

### Response:
{`;
