/**
 * 🧠 Jobo AI - Universal Cognitive Intent Detector (Phase 3-C: The Soul of AI)
 * Responsibility: Understanding the Psychological Motive and Contextual Bhaav.
 */
module.exports = (query, context) => `
Task: Conduct a deep psychological and semantic analysis of the user query.
Think like a human mentor who reads between the lines. Do not look for keywords; look for the "Goal".

# PHASE 1: TOKEN-BY-TOKEN PSYCHOLOGY
Analyze every word in the query "${query}":
- What is the emotional state? (Stressed, Curious, Casual)
- What is the subject of interest? (A specific job, personal data, or future path?)
- Is the user asking for "Information" (Facts) or "Transformation" (Guidance)?

# PHASE 2: PRIMARY MOTIVE TAXONOMY (THE BHAAV)
Classify into exactly ONE of these high-level motives:
1. RAPPORT: Greeting, small talk, or testing Jobo's identity.
2. DISCOVERY: The user is exploratory. "What's new?", "Top 10", "Latest trends". No specific job name mentioned.
3. TRANSACTIONAL: Targeted search. User named a job/org (SSC, Bank, UPSC) and wants vacancies.
4. FACTUAL: Micro-details of a target. Inquiry about Fees, Age, Date, Salary, Syllabus, or Height.
5. GUIDANCE: Macro-pathway. "How to become", "What to do after X", "Roadmap", "Career advice".
6. PERSISTENCE: Personal data. Asking about their own name, qualification, or updating their profile.
7. ADMINISTRATIVE: Checking status. Results, admit cards, or application confirmation.
8. EMOTIONAL: Purely seeking motivation or expressing feelings like exam stress.

# PHASE 3: CONTEXTUAL RESOLUTION
- Context Topic: ${context.topic || 'None'}
- If query is "fees?" and topic is "SSC", the motive is FACTUAL and subIntent is "FEES".
- If user says "IAS", motive is TRANSACTIONAL. If they say "IAS kaise bane", motive is GUIDANCE.

# MANDATORY OUTPUT FORMAT (VALID JSON ONLY):
{
  "thought_process": "1 sentence step-by-step reasoning of how you reached the intent",
  "domain": "GOVT_JOBS | CAREER | PERSONAL | RAPPORT",
  "primaryIntent": "CATEGORY_NAME",
  "subIntent": "SPECIFIC_FACT_OR_ENTITY",
  "implicitGoal": "What the user actually wants in 5 words",
  "emotionalTone": "NEUTRAL | URGENT | FRUSTRATED | EXCITED | POLITE",
  "discourse": "NEW_TOPIC | FOLLOW_UP",
  "behavior": "RESPOND | CLARIFY",
  "confidence": 0.0-1.0
}

Current Query: "${query}"

ANALYSIS:
`;
