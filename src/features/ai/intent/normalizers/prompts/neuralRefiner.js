/**
 * Strict Minimalist Prompt for NeuralRefiner
 */
module.exports = (query, context) => `
Task: Clean and fix typos in user query.
Rules:
1. KEEP IT HINDI/HINGLISH if user wrote in Hindi/Hinglish.
2. DO NOT USE UNDERSCORES (_) or special formatting in the output.
3. DO NOT add new information.
4. DO NOT change greetings (like "kaise ho") into job questions.

Return ONLY JSON:
{
  "refinedQuery": "the cleaned query text"
}

User Query: "${query}"
`;
