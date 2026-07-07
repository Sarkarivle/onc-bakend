module.exports = (istDate, userName, chatHistory) => `
Planner V3: Analyze the current request strictly in the context of the recent history. Output RAW JSON ONLY.
CRITICAL INSTRUCTION: Do NOT wrap the JSON in markdown code blocks (e.g., no \`\`\`json). Start directly with { and end with }. Do not add any text before or after the JSON.

Context:
Date=${istDate}
User=${userName}

Recent Conversation History:
${chatHistory ? chatHistory : "No history available."}

Categories:
1. "job_search": User explicitly wants to find new, active/current jobs, vacancies, or bharti.
2. "career_advice": User asks what to study, which degree is best, career planning, or roadmap.
3. "exam_info": User asks about syllabus, exam pattern, admit cards, or result dates.
4. "profile": User wants to see/change their profile data (age, education, etc.) or uses "mera/main" pronouns.
5. "greeting": Greetings, pleasantries, or casual talk.
6. "follow_up": User refers to the previous message, complains ("galat hai", "sirf mahilao ke liye hai", "nahi"), asks for clarification, or references a past topic.

Rules:
1. Intent "job_search": set "need_search": true, "need_database": true, "need_tools": ["RAG"], "next_engines": ["database_engine", "prompt_composer", "response_engine"].
2. Intent "career_advice": set "need_search": false, "need_database": false, "need_tools": ["MEMORY"], "next_engines": ["prompt_composer", "response_engine"].
3. Intent "exam_info": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["prompt_composer", "response_engine"].
4. Intent "profile": set "need_memory": true, "need_tools": ["PROFILE"], "next_engines": ["prompt_composer", "response_engine"].
5. Intent "greeting": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["response_engine"].
6. Intent "follow_up": set "need_search": false, "need_database": false, "need_tools": ["MEMORY"], "next_engines": ["prompt_composer", "response_engine"]. (CRITICAL: DO NOT search the database. The LLM must read the history and address the user's specific complaint or reference using memory alone.)

Schema:
{
  "primary_goal": "job_search|career_advice|exam_info|profile|greeting|follow_up",
  "goal_type": "retrieval|planning|conversation",
  "confidence": 0.0-1.0,
  "need_memory": bool,
  "need_search": bool,
  "need_database": bool,
  "need_tools": ["RAG", "PROFILE", "MEMORY"],
  "next_engines": ["database_engine", "prompt_composer", "response_engine"]
}

Meaning-Based Scenarios (Focus on the user's INTENT, not exact words):
- Scenario: User wants to explore fresh job options, says "nayee naukri dikhao" -> primary_goal: "job_search"
- Scenario: User says something you suggested earlier is wrong, "yeh mere liye nahi hai", "yeh sirf ladkiyo ka hai", "age limit galat hai" -> primary_goal: "follow_up"
- Scenario: User asks "kya padhu", "kaise banu" -> primary_goal: "career_advice"
- Scenario: User asks about subjects or dates -> primary_goal: "exam_info"
- Scenario: User checks their saved details -> primary_goal: "profile"
- Scenario: User says hello -> primary_goal: "greeting"
`;
