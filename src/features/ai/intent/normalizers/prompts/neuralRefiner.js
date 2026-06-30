/**
 * Scalable Few-Shot Neural Refiner
 */
module.exports = (query, context) => `
Task: Fix typos and clean user query.
CRITICAL: NEVER TRANSLATE TO ENGLISH. Keep Hindi words in Hindi/Hinglish.

Examples:
1. Input: "behan ko naukri" -> { "refinedQuery": "behan ko naukri" }
2. Input: "kaise ho jobo bhai" -> { "refinedQuery": "kaise ho jobo bhai" }
2. Input: "nkri" -> { "refinedQuery": "naukri" }
3. Input: "m kitne sal ka hu" -> { "refinedQuery": "main kitne saal ka hoon" }
4. Input: "fees?" (Topic: SSC GD) -> { "refinedQuery": "SSC GD ki fees kitni hai?" }

Current Task:
User Query: "${query}"
Context Topic: "${context.topic || 'None'}"

Return ONLY JSON:
{
  "refinedQuery": "the cleaned query"
}
`;
