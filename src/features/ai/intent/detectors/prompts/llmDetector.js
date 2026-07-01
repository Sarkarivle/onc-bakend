/**
 * Scalable Few-Shot Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Categorize the user query.

Examples:
- "kaise ho jobo bhai" -> { "primaryIntent": "GREETING", "tone": "POLITE" }
- "top 5 jobs", "nayi bharti dikhao" -> { "primaryIntent": "DISCOVERY", "tone": "CURIOUS" }
- "naukri chahiye", "behan ke liye sarkari naukri" -> { "primaryIntent": "JOB_SEARCH", "tone": "CURIOUS" }
- "fees kitni hai", "umar kya hai", "aakhri tarikh" -> { "primaryIntent": "FIELD_CHECK", "tone": "CURIOUS" }
- "UP Police age limit" -> { "primaryIntent": "FIELD_CHECK", "tone": "CURIOUS" }
- "main kitne saal ka hu" -> { "primaryIntent": "PROFILE_INQUIRY", "tone": "CURIOUS" }

Current Task:
Query: "${query}"

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "reasoning": "brief reason",
  "tone": "CURIOUS"
}
`;
