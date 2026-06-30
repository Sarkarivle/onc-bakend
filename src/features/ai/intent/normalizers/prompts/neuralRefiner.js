/**
 * Strict Minimalist Prompt for NeuralRefiner
 */
module.exports = (query, context) => `
Task: Clean and fix typos in user query.
Rules:
1. KEEP IT HINDI/HINGLISH. "jobo" is a name, NOT "job".
2. USE SPACES ONLY. NEVER use underscores (_) between words.
3. DO NOT add new information.
4. DO NOT change greetings into job questions.

Return ONLY JSON:
{
  "refinedQuery": "the cleaned query text"
}

User Query: "${query}"
`;
