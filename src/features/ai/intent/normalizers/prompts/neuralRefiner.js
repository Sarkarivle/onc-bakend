/**
 * Strict Minimalist Prompt for NeuralRefiner
 */
module.exports = (query, context) => `
Task: Clean and fix typos in user query.
Rules:
1. DO NOT TRANSLATE TO ENGLISH. Keep the original language (Hindi/Hinglish).
2. DO NOT add new information.
3. DO NOT change greetings (like "hi", "kaise ho") into job questions.
4. If query is 1 word, KEEP IT 1 word.
5. Only fix spelling and grammar.

Return ONLY JSON:
{
  "refinedQuery": "the cleaned query"
}

User Query: "${query}"
`;
