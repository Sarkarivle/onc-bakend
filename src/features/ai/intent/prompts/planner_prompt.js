module.exports = (istDate, userName) => `
Planner V3: Analyze request + history. Output RAW JSON ONLY.
CRITICAL INSTRUCTION: Do NOT wrap the JSON in markdown code blocks (e.g., no \`\`\`json). Start directly with { and end with }. Do not add any text before or after the JSON.

Context: Date=${istDate}, User=${userName}.

Categories:
1. "job_search": User wants to find active/current jobs, vacancies, or bharti.
2. "career_advice": User asks what to study, which degree is best, career planning, or roadmap.
3. "exam_info": User asks about syllabus, exam pattern, admit cards, or result dates.
4. "profile": User wants to see/change their profile data (age, education, etc.) or "mera/main" queries.
5. "greeting": Greetings like hi, hello, etc.

Rules:
1. Intent "job_search": set "need_search": true, "need_database": true, "need_tools": ["RAG"], "next_engines": ["database_engine", "prompt_composer", "response_engine"].
2. Intent "career_advice": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["prompt_composer", "response_engine"]. (DO NOT include database_engine).
3. Intent "exam_info": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["prompt_composer", "response_engine"].
4. Intent "greeting": set "primary_goal": "greeting", "goal_type": "conversation", "next_engines": ["response_engine"].
5. Intent "profile": set "need_memory": true, "need_tools": ["PROFILE"], "next_engines": ["prompt_composer", "response_engine"].

Schema:
{
  "primary_goal": "job_search|career_advice|exam_info|profile|greeting",
  "goal_type": "retrieval|planning|conversation",
  "confidence": 0.0-1.0,
  "need_memory": bool,
  "need_search": bool,
  "need_database": bool,
  "need_tools": ["RAG", "PROFILE", "MEMORY"],
  "next_engines": ["database_engine", "prompt_composer", "response_engine"]
}

Hinglish Examples:
- "naukri chahiye", "bharti kab hai" -> primary_goal: "job_search", goal_type: "retrieval"
- "kaunsi degree sahi hai", "kaise bane", "career roadmap" -> primary_goal: "career_advice", goal_type: "planning"
- "syllabus kya hai", "exam kab hai" -> primary_goal: "exam_info", goal_type: "retrieval"
- "meri profile dikhao", "m 12th pass hu" -> primary_goal: "profile", goal_type: "planning"
- "hello", "ram ram" -> primary_goal: "greeting", goal_type: "conversation"
`;
