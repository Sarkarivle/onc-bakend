/**
 * Robust Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Categorize the user query into exactly ONE category.
Query: "${query}"

Categories & Examples:
- GREETING: "hi", "kaise ho", "hello", "namaste".
- PROFILE_INQUIRY: User asking about THEIR data ("main kitne saal ka hu", "mera status", "my age").
- JOB_SEARCH: Seeking specific job vacancies ("SSC vacancy", "Police jobs").
- FIELD_CHECK: General rules of a job ("fees", "age limit", "syllabus").
- DISCOVERY: Seeking lists of best/latest jobs ("top 5 jobs", "trending jobs", "latest jobs").

Strict Mapping:
- "kaise ho" -> GREETING
- "top 5 jobs" -> DISCOVERY
- "fees" -> FIELD_CHECK
- "naukri" -> JOB_SEARCH

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "reasoning": "brief reason",
  "tone": "CURIOUS"
}
`;
