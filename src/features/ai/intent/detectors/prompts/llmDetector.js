/**
 * Robust Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Categorize the user query.
Query: "${query}"

Categories & Examples:
- GREETING: "hi", "kaise ho", "jobo bhai", "hello".
- PROFILE_INQUIRY: User asking about THEIR data ("main kitne saal ka hu", "mera status").
- JOB_SEARCH: Seeking specific vacancies ("naukri", "SSC vacancy").
- FIELD_CHECK: General rules of a job ("fees", "age limit").
- DISCOVERY: Seeking lists of jobs ("top 5 jobs", "latest jobs").

Strict Logic:
- "kaise ho jobo bhai" is ALWAYS GREETING.
- "main kitne saal ka hu" is ALWAYS PROFILE_INQUIRY.
- "fees" is ALWAYS FIELD_CHECK.
- If the query is a QUESTION (ends in ? or asks "kya hai", "kitna hai"), TONE must be "CURIOUS".

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "reasoning": "brief",
  "tone": "CURIOUS"
}
`;
