/**
 * Strict Minimalist Prompt for NeuralRefiner
 */
module.exports = (query, context) => `
Task: Clean and fix typos in user query.
Rules:
1. DO NOT add new information.
2. DO NOT change greetings (like "hi", "kaise ho") into job questions.
3. If query is 1 word, KEEP IT 1 word.
4. Only fix spelling and grammar.

Return ONLY JSON:
{
  "refinedQuery": "the cleaned query"
}

User Query: "${query}"
`;
