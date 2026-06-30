/**
 * Minimalist Prompt for NeuralRefiner
 */
module.exports = (query, context) => `Task: Fix typos and clarify for a job assistant.
Input: "${query}"
Output JSON: { "refinedQuery": "`;
