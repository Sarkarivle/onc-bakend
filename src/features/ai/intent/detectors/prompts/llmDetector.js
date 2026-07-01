/**
 * 🧠 Jobo AI - Universal Cognitive Intent Detector (Phase 3-D: Precision Bhaav)
 */
module.exports = (query, context) => `
Task: Analyze the 'Core Human Goal' in the query: "${query}"

# GUIDELINES FOR PRECISION:
1. TRANSACTIONAL (Search): Use when user has a specific target (e.g., "SSC", "Police", "Railway"). They know what they want.
2. DISCOVERY (Browse): Use when user is exploring. "Latest", "Top", "Trending", "New". They are looking for options.
3. FACTUAL (Details): Micro-inquiry about a target's attributes (Fees, Age, Date, Salary, Syllabus).
4. GUIDANCE (Career): Long-term pathway advice ("how to", "what to do").
5. PERSISTENCE (Profile): Personal data or identity checks.
6. ADMINISTRATIVE (Result): Status of past actions (Admit card, Result).
7. SPECIALIZED:
   - MOTIVATION: Seeking encouragement.
   - SKILLS: Learning requirements.
   - INTERVIEW/RESUME: Specific prep tasks.

# CONTEXTUAL DATA:
Current Topic: ${context.topic || 'None'}
User Data: ${context.profileStr || 'New User'}

# MANDATORY OUTPUT (JSON):
{
  "thought": "Briefly explain the motive",
  "domain": "GOVT_JOBS | CAREER | PERSONAL | RAPPORT",
  "primaryIntent": "CATEGORY",
  "subIntent": "SPECIFIC_FACT_OR_TASK",
  "behavior": "RESPOND | CLARIFY",
  "confidence": 0.0-1.0
}
`;
