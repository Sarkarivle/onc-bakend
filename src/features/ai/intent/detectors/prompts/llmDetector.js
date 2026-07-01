/**
 * 🧠 Jobo AI - Universal Cognitive Intent Detector (Phase 3-E: Few-Shot Mastery)
 * Responsibility: Exact mapping using high-precision examples. No ambiguity.
 */
module.exports = (query, context) => `
Task: Classify the user query into exactly ONE category based on the examples below.

# CATEGORIES & EXAMPLES:

1. JOB_SEARCH (Targeted search for vacancies)
   - "ssc gd vacancy", "railway bharti", "police jobs", "nayi naukri dikhao"

2. FIELD_DETAILS (Specific facts about a target)
   - "fees kitni hai", "umar kya hai", "last date kab hai", "syllabus kya hai", "salary kitni hai"

3. DISCOVERY (Broad browsing/exploring)
   - "top 10 jobs", "latest government jobs", "trending vacancies", "kuch naya batao"

4. CAREER_GUIDANCE (Macro-pathways and advice)
   - "10th ke baad kya karein", "how to become IAS", "doctor kaise bane", "career roadmap"

5. PROFILE_INQUIRY (User's own data/settings)
   - "mera naam kya hai", "check my profile", "update my education", "meri qualification"

6. RESULT_ADMIT_CARD (Status of past actions)
   - "ssc result kab aayega", "download admit card", "score card date"

7. GREETING (Rapport and small talk)
   - "hi", "hello", "namaste jobo", "kaise ho bhai"

8. IDENTITY (Who is Jobo?)
   - "who are you", "aapka founder kaun hai", "tum kya kaam karte ho"

9. SPECIALIZED_GUIDANCE (Specific tasks)
   - "resume kaise banaye", "interview tips", "scholarship details", "skills for 2025"

# CONTEXT:
- Current Topic: ${context.topic || 'None'}
- If query is "fees?" or "date?", it belongs to FIELD_DETAILS based on topic.

# OUTPUT RULES:
- Return ONLY valid JSON.
- Use EXACT category names from the list above.

Query: "${query}"

JSON RESPONSE:
`;
