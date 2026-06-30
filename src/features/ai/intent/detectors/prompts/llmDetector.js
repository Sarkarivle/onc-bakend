/**
 * Upgraded Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Categorize the user query.
Query: "${query}"

Categories:
- GREETING: "hi", "kaise ho", "jobo bhai".
- PROFILE_INQUIRY: User asking about THEIR data ("main kitne saal ka hu").
- JOB_SEARCH: Seeking specific vacancies ("naukri", "SSC vacancy").
- FIELD_CHECK: General rules of a job ("fees", "age limit", "syllabus").
- DISCOVERY: Seeking lists of jobs ("top 5 jobs", "latest jobs").

LOGIC UPGRADE:
- "kaise ho jobo bhai" is ALWAYS GREETING.
- If the query asks "kya hai", "kitna hai", "fees", or "age limit", Tone MUST be "CURIOUS".
- Even if it's a statement about a job rule, categorize as FIELD_CHECK.

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "reasoning": "brief",
  "tone": "CURIOUS"
}
`;
