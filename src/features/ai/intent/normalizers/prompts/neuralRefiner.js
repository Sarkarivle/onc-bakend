/**
 * Prompt for NeuralRefiner Task (JSON Mode)
 */
module.exports = (query, context) => `
Task: User Query Refinement.
User Query: "${query}"

[CONTEXT]:
- Last Topic: "${context.topic || 'None'}"
- Conversation Turn: ${context.turnCount || 0}

Instructions:
1. Fix typos (e.g., "nkri" -> "naukri").
2. DO NOT add new information (like age, specific jobs, or names) unless they are in the User Query or Context.
3. GREETING PROTECTION: If query is "hi", "kaise ho", etc., set "refinedQuery" to the original query.
4. SHORT QUERIES: If query is 1-2 words (e.g., "naukri", "fees") and there is NO [CONTEXT], do NOT expand it.
5. COMPLETE FOLLOW-UPS: If query is "fees?" and context is "SSC", set "refinedQuery" to "SSC ki fees kitni hai?".

Return ONLY a valid JSON object.
DO NOT include any text before or after the JSON.
DO NOT include "Refined Query:" or "Reasoning:" as plain text labels outside the JSON.

JSON Format:
{
  "refinedQuery": "The perfected query",
  "isAmbiguous": false,
  "reasoning": "Brief explanation"
}`;
