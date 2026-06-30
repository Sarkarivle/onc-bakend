/**
 * Prompt for AgenticPlanner Task
 */
module.exports = (query, intent, context) => `
Task: Strategic Planning for Jobo AI Agent.
User Query: "${query}"
Resolved Intent: ${JSON.stringify(intent)}

[CONTEXT]:
- Current Topic: "${context.topic || 'None'}"
- User Profile Summary: ${context.profileStr || 'Unknown'}

Instructions:
1. Analyze if the user wants specific data (Live Jobs), general advice, a simple greeting, or small-talk about Jobo itself.
2. Select the necessary tools from this list: ["DATABASE", "WEB_SEARCH", "USER_PROFILE"].
3. Decide the response mode: "JOB_SEARCH", "JOB_DETAILS", "CAREER_GUIDANCE", "GENERAL_HELP".
4. For SMALL_TALK / assistant identity / assistant location questions, choose no tools, mode "GENERAL_HELP", behavior "RESPOND".
5. List which expert modules should be loaded: ["GOVT_JOB", "CAREER", "RESUME", "SCHOLARSHIP"].

Return ONLY this JSON format:
{
  "thought": "Brief explanation of your strategy",
  "tools": ["TOOL_1", "TOOL_2"],
  "mode": "MODE_NAME",
  "priorityModules": ["MODULE_1", "MODULE_2"],
  "behavior": "RESPOND | CLARIFY | GREET"
}

Example: If user asks for "SSC GD Fees", thought is "User needs factual fee info", tools are ["DATABASE"], mode is "JOB_DETAILS".`;
