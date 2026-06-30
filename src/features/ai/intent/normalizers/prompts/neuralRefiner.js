/**
 * Refined Prompt for Mistral Neural Refiner
 */
module.exports = (query, context) => `
Task: Refine the user query for a job assistant.
Context Topic: "${context.topic || 'None'}"

Instructions:
1. Keep the language same as user (Hindi/English/Hinglish).
2. Fix typos.
3. If query is "fees?" and context is "SSC", refine to "SSC ki fees kya hai?".
4. If query is already clear, return it as is.

Return ONLY this JSON:
{
  "refinedQuery": "The perfected query"
}

User Query: "${query}"
`;
