/**
 * Pure Neural Intent Detection Prompt (Gemini-Grade)
 */
module.exports = (query, context) => `
Task: Analyze the 'Motive' and 'Context' behind the user query. Do not just look for keywords; understand the goal.

Available Motives:
- GREETING: Establishing rapport (Namaste, hi, kaise ho, etc.)
- IDENTITY: Knowing about Jobo AI's nature or origin.
- DISCOVERY: Seeking lists of "new", "top", "trending", or "latest" options without a specific entity.
- JOB_SEARCH: Searching for specific vacancies, organizations, or recruitment drives.
- FIELD_CHECK: Inquiry about specific facts/attributes of a job (fees, age, date, salary, syllabus, height, etc.)
- CAREER_GUIDANCE: Seeking "how-to", "what-to-do", "pathways", or "guidance" for the future.
- PROFILE_INQUIRY: Asking about user's own saved data or identity.
- RESULT_ADMIT_CARD: Seeking status updates on exams already taken.
- SCHOLARSHIP: Financial aid inquiries.
- RESUME/INTERVIEW: Career preparation tasks.
- SKILLS: Learning or skill requirements.
- MOTIVATION: Seeking encouragement.

Guidelines:
1. Trust the Context: If the user says "fees?", look at the Current Topic (${context.topic || 'None'}) to classify it as FIELD_CHECK.
2. Discern "Search" vs "Discovery": "SSC jobs" is JOB_SEARCH. "Any new jobs" is DISCOVERY.
3. Handle Short Queries: Map short, meaningful queries like "naukri?" to JOB_SEARCH with behavior CLARIFY.

Current Task:
Query: "${query}"

Output ONLY valid JSON:
{
  "primaryIntent": "MOTIVE",
  "subIntent": "SPECIFIC_FACT_IF_ANY",
  "discourse": "NEW_TOPIC | FOLLOW_UP",
  "confidence": 0.0-1.0,
  "behavior": "RESPOND | CLARIFY",
  "reasoning": "Explain the motive behind this choice"
}
`;
