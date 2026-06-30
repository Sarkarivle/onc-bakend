/**
 * Prompt for NeuralRefiner Task
 * Filename matches the logic file: normalizers/neuralRefiner.js
 */
module.exports = (query, context) => `
Task: User Query Refinement (Hinglish/English).

[CONTEXT]:
- Last Topic Discussed: "${context.topic || 'None'}"
- Conversation Turn: ${context.turnCount || 0}

[USER QUERY]: "${query}"

Instructions:
1. Fix typos (e.g., "nkri" -> "naukri", "bihr" -> "bihar", "gratuate" -> "graduate").
2. GREETING PROTECTION: If the query is a greeting (e.g., "hi", "kaise ho", "namaste", "hey jobo"), do NOT expand it using context. Return it as is.
3. SHORT & AMBIGUOUS QUERIES:
   - If a query is very short and generic (e.g., "naukri", "job", "fees", "exam") and there is NO [CONTEXT], do NOT expand it into a full request.
   - Instead, keep it as is or slightly normalize it (e.g., "job" -> "jobs").
   - This allows the system to identify that the user needs to provide more details.
4. Always prioritize clarity over literal translation.
5. If the user provides a qualification or location, ensure it's preserved in the refined query.

Output ONLY the refined text. No preamble.`;
