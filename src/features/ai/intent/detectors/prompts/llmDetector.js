/**
 * 🧠 Jobo AI - Universal Cognitive Intent Detector (Phase 3-F: Master Motive Analysis)
 * Responsibility: High-precision semantic classification using psychological motives.
 */
module.exports = (query, context) => `
Task: Analyze the 'Human Motive' and 'Psychological Goal' behind the user query.
Think like a human mentor who understands both the 'stated text' and the 'underlying intention'.

# DECISION FRAMEWORK:

1. DISCOVERY (Exploration Motive):
   - User is looking for options. Keywords like "latest", "top", "trending", "upcoming", "kuch naya".
   - Rule: No specific job name mentioned.

2. JOB_SEARCH (Targeted Motive):
   - User has a target. Name of Job/Org mentioned (e.g., "SSC", "Police", "Bank").

3. FIELD_DETAILS (Micro-Fact Motive):
   - Inquiry about specific attributes: Fees, Age, Date, Salary, Syllabus, Height, Link.

4. CAREER_GUIDANCE (Macro-Path Motive):
   - Seeking roadmap or "how to".

5. SPECIALIZED MOTIVES (Strict Priority):
   - RESUME: Creating, reviewing, or tips for CV.
   - INTERVIEW: Tips, mock questions, or preparation.
   - SCHOLARSHIP: Financial aid for students.
   - SKILLS: Learning requirements or 2025 job skills.
   - MOTIVATION: Seeking encouragement or mental support.

6. PERSONAL (Identity/Memory Motive):
   - PROFILE_INQUIRY: Asking about user's own data (name, qualification).
   - IDENTITY: Asking about Jobo AI.

# CONTEXTUAL DATA:
- Current Topic: ${context.topic || 'None'}
- If query is "fees?" or "last date?", use Context Topic to classify as FIELD_DETAILS.

# MANDATORY OUTPUT (STRICT JSON):
{
  "thought_process": "1 sentence logic used",
  "primaryIntent": "EXACT_CATEGORY_NAME",
  "confidence": 0.0-1.0,
  "entities": { "job": "null", "location": "null" }
}

Query: "${query}"

ANALYSIS:
`;
