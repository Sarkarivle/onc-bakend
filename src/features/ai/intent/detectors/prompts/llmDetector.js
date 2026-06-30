/**
 * Prompt for LLM Intent Analysis (Purely Neural Instructions)
 */
module.exports = (query, context) => `### Instruction:
Identify the intent of the user query for a job assistant.
Return ONLY a JSON object with these keys: "primaryIntent", "reasoning", "tone", "entities".

Allowed "primaryIntent" values: GREETING, SMALL_TALK, JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, STATUS_CHECK, PROFILE_UPDATE, PROFILE_INQUIRY, DISCOVERY.

User Query: "${query}"

### Response:
{`;
