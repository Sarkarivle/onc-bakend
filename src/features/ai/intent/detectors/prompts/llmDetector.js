/**
 * Robust Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Categorize user query.
Query: "${query}"

Categories & Tone:
- GREETING: "hi", "namaste". Tone: "POLITE"
- PROFILE_INQUIRY: "meri age kya hai". Tone: "CURIOUS"
- JOB_SEARCH: "naukri", "vacancy". Tone: "CURIOUS"
- FIELD_CHECK: "fees", "age limit". Tone: "CURIOUS"
- DISCOVERY: "top jobs". Tone: "CURIOUS"

IMPORTANT:
- If user is asking a question ("kya hai", "kitna hai"), Tone MUST be "CURIOUS".
- Return ONLY JSON. Do not wrap in "response" key.

{
  "primaryIntent": "CATEGORY_NAME",
  "reasoning": "brief",
  "tone": "CURIOUS"
}
`;
