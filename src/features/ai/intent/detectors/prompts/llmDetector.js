/**
 * 🧠 Jobo AI - Universal Cognitive Intent Detector (Phase 3-B)
 * Responsibility: Deep semantic understanding of human motives, entities, and emotions.
 */
module.exports = (query, context) => `
Task: Conduct a high-level cognitive analysis of the user's query.
Act as an expert human mentor who understands both the 'stated text' and the 'underlying psychological motive'.

# 1. PRIMARY DOMAINS:
- GOVT_JOBS: Search, details, notifications, or eligibility for government exams.
- CAREER_PATH: Roadmaps, "how-to", guidance, scholarships, resumes, or interview prep.
- PERSONAL: User profile, identity, qualification updates, or memory recall.
- RAPPORT: Greetings, small talk, testing AI personality, or identity of Jobo.
- SYSTEM: Technical issues, feedback, or general out-of-scope knowledge.

# 2. INTENT CLASSIFICATION (BHAAV):
- DISCOVERY: Seeking lists of "new", "top", "trending", or "latest" options.
- TRANSACTIONAL: Targeted search for a specific entity (e.g., "SSC GD bharti").
- FACTUAL: Inquiry about specific attributes (Fees, Age, Date, Salary, Syllabus, Height).
- GUIDANCE: Seeking pathways, roadmap, or "what to do" advice.
- ADMINISTRATIVE: Result status, admit card, or application status.
- PERSISTENCE: Talking about self, updating own records, or asking "who am I".
- EMOTIONAL: Purely seeking motivation or expressing feelings (stress, joy).

# 3. CONTEXTUAL INTELLIGENCE:
- Current Topic: ${context.topic || 'None'}
- Previous Knowledge: ${context.profileStr || 'New User'}
- If query is anaphoric (e.g., "uski fees?", "kab aayega?"), resolve it using the Current Topic.

# 4. OUTPUT SCHEMA (MANDATORY JSON):
{
  "domain": "GOVT_JOBS | CAREER | PERSONAL | RAPPORT | SYSTEM",
  "primaryIntent": "CATEGORY_NAME",
  "subIntent": "SPECIFIC_ENTITY_OR_DETAIL",
  "emotionalTone": "NEUTRAL | CURIOUS | URGENT | FRUSTRATED | EXCITED",
  "discourse": "NEW_TOPIC | FOLLOW_UP",
  "behavior": "RESPOND | CLARIFY",
  "entities": {
    "job": "string | null",
    "location": "string | null",
    "category": "string | null"
  },
  "implicitGoal": "1 sentence describing the user's true psychological need",
  "confidence": 0.0-1.0
}

Current Query: "${query}"

ANALYSIS:
`;
