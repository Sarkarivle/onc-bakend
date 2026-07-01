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

Rules:
1. If user is asking for "Top X jobs" or "Best jobs", use "DISCOVERY".
2. If user is asking for specific details like "fees", "age", or "date", use "FIELD_CHECK" and put the detail name in "subIntent".
3. Use "JOB_SEARCH" only for general "naukri chahiye" or specific job vacancy searches.

Current Task:
Query: "${query}"

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY_NAME",
  "subIntent": "DETAIL_IF_ANY",
  "reasoning": "brief reason",
  "tone": "CURIOUS"
}
`;
