/**
 * Prompt for LLM Intent Analysis (Base Model Optimized)
 */
module.exports = (query, context) => `
Task: Analyze the intent of a job assistant user query.
User Query: "${query}"

Categories:
- GREETING: "hi", "kaise ho"
- JOB_SEARCH: Searching for specific vacancies.
- FIELD_CHECK: Asking for fees, age limit, or syllabus.
- PROFILE_INQUIRY: User asking about their own stored data (age, name).
- DISCOVERY: "latest jobs", "top 5 jobs".

Return ONLY this JSON format:
{
  "primaryIntent": "CATEGORY",
  "reasoning": "Brief explanation",
  "tone": "POLITE/CURIOUS/etc"
}
`;
