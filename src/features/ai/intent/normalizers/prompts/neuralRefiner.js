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
1. Fix typos (e.g., "nkri" -> "naukri", "bihr" -> "bihar").
2. If query is short/incomplete (e.g., "fees?", "apply?"), use [CONTEXT] to complete it.
3. If context is empty and query is incomplete, expand it into a general request (e.g., "job" -> "Show me latest jobs").
4. If query is already clear, just return it.

Output ONLY the refined text. No preamble.`;
