/**
 * Prompt for NeuralRefiner Task (Base Model Optimized)
 */
module.exports = (query, context) => `
Task: Refine and clarify the user's query for a job assistant.
Instructions:
1. Fix typos (e.g., "nkri" -> "naukri").
2. Complete fragmented queries using context (Topic: "${context.topic || 'None'}").
3. DO NOT answer the query. Just return the perfected version.
4. If it's a simple greeting, keep it as is.

Return ONLY this JSON format:
{
  "refinedQuery": "The corrected and completed query"
}

User Query: "${query}"
`;
