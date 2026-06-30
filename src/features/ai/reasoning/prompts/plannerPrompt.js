/**
 * Few-Shot Prompt for Agentic Planning
 */
module.exports = (query, intent, context) => `Plan for job assistant.
Intent: ${intent.primaryIntent}
Query: "${query}"

Output JSON: { "thought": "`;
