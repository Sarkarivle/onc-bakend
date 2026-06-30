/**
 * Robust Intent Detection for Mistral
 */
module.exports = (query, context) => `
Task: Detect intent.
Query: "${query}"

Categories:
- GREETING: "hi", "kaise ho", "hello".
- PROFILE_INQUIRY: User asking about THEIR data ("main kitne saal ka hu", "mera status").
- JOB_SEARCH: Searching for jobs ("naukri", "SSC vacancy").
- FIELD_CHECK: Job rules ("fees", "age limit").
- DISCOVERY: "top jobs", "trending".

Instructions:
- "kaise ho" is GREETING.
- "naukri" is JOB_SEARCH (but ambiguous).
- "main kitne saal ka hu" is PROFILE_INQUIRY.

Return ONLY JSON:
{
  "primaryIntent": "CATEGORY",
  "reasoning": "why",
  "tone": "CURIOUS/POLITE"
}
`;
