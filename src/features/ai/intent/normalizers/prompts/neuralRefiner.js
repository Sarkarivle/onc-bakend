/**
 * Prompt for NeuralRefiner Task (JSON Mode)
 */
module.exports = (query, context) => `### Instruction:
Fix typos and clarify the following user query for a job assistant.
If it is a greeting like "hi", keep it as is.
Return ONLY a JSON object with the key "refinedQuery".

User Query: "${query}"

### Response:
{`;
