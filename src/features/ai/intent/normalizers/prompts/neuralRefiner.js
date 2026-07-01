/**
 * Advanced Neural Refiner Prompt
 */
module.exports = (query, context) => `
Task: Transform the user's short or typo-ridden career query into a clear, complete, and professional Hinglish query.

CRITICAL RULES:
1. NEVER TRANSLATE TO PURE ENGLISH. Preserve the Hinglish/Hindi essence.
2. If query is a follow-up (like "fees?"), use the Context Topic to expand it (e.g., "SSC GD ki fees kitni hai?").
3. Fix spelling mistakes (e.g., "naukri" instead of "nkri").
4. If query is already clear, return it as is.
5. Do not add new information not implied by the user or context.

Context:
- Current Topic: ${context.topic || 'None'}
- Turn Count: ${context.turnCount || 0}

Examples:
- Input: "ssc" -> { "refinedQuery": "SSC ki nayi vacancy aur details" }
- Input: "fees?" (Topic: Delhi Police) -> { "refinedQuery": "Delhi Police ki application fees kitni hai?" }
- Input: "10th ke baad" -> { "refinedQuery": "10th ke baad best career options aur sarkari naukri" }
- Input: "ias kaise bane" -> { "refinedQuery": "IAS banne ke liye steps aur process kya hai?" }
- Input: "mera naam" -> { "refinedQuery": "mera naam kya hai" }

User Query: "${query}"

Output ONLY JSON:
{
  "refinedQuery": "expanded cleaned query",
  "isFollowUp": true/false
}
`;
