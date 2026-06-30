/**
 * Refined Prompt for Mistral Intent Analysis
 */
module.exports = (query, context) => `
Task: Identify intent for a job assistant.
User Query: "${query}"

Categories:
- GREETING: "hi", "hello", "kaise ho".
- JOB_SEARCH: Asking for jobs (e.g., "UP Police jobs", "behen ko naukri").
- FIELD_CHECK: Asking for rules/data of a job (e.g., "SSC fees", "age limit").
- PROFILE_INQUIRY: User asking about THEIR OWN data (e.g., "main kitne saal ka hu", "mera naam kya hai"). Keywords: "main", "m", "mera", "hu".
- DISCOVERY: "top 5 jobs", "trending jobs", "latest vacancy".

Tone Guide:
- If user asks "Kya hai?", "Kitna hai?", "Kab hai?" -> Tone is "CURIOUS".
- If user just greets -> Tone is "POLITE".

Return ONLY this JSON format:
{
  "primaryIntent": "CATEGORY",
  "reasoning": "Brief explanation",
  "tone": "CURIOUS/POLITE/CASUAL"
}
`;
