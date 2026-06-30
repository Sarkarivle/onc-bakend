/**
 * Few-Shot Prompt for Intent Analysis
 */
module.exports = (query, context) => `Identify intent for a job assistant.
Categories: [GREETING, JOB_SEARCH, FIELD_CHECK, CAREER_ADVICE, PROFILE_INQUIRY, DISCOVERY]

Examples:
- "kaise ho": GREETING
- "naukri": DISCOVERY
- "top 5 jobs": DISCOVERY
- "SSC GD fees": FIELD_CHECK
- "UP Police age limit": FIELD_CHECK
- "Delhi Police jobs": JOB_SEARCH
- "meri age": PROFILE_INQUIRY

Input: "${query}"
Output JSON: { "primaryIntent": "`;
