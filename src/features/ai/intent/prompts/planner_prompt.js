```javascript
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
6. "follow_up": User refers to the previous message, disagrees, asks for clarification, or references a past topic.

Rules:
1. Intent "job_search": set "need_search": true, "need_database": true, "need_tools": ["RAG"], "next_engines": ["database_engine", "prompt_composer", "response_engine"].
2. Intent "career_advice": set "need_search": false, "need_database": false, "need_tools": ["MEMORY"], "next_engines": ["prompt_composer", "response_engine"].
3. Intent "exam_info": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["prompt_composer", "response_engine"].
4. Intent "profile": set "need_memory": true, "need_tools": ["PROFILE"], "next_engines": ["prompt_composer", "response_engine"].
5. Intent "greeting": set "need_search": false, "need_database": false, "need_tools": [], "next_engines": ["response_engine"].
6. Intent "follow_up": set "need_search": false, "need_database": false, "need_tools": ["MEMORY"], "next_engines": ["prompt_composer", "response_engine"]. (DO NOT search database for follow-ups).

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
- Scenario: User is actively looking for current openings, asking about new forms, or using words related to active recruitment.
  -> primary_goal: "job_search"

- Scenario: User is asking for guidance on what to study, comparing degrees, or asking how to build a career in a specific field.
  -> primary_goal: "career_advice"

- Scenario: User wants to know about the subjects for an exam, when an exam will happen, or result declarations.
  -> primary_goal: "exam_info"

- Scenario: User is talking about their own qualifications, asking what is saved in their data, or wants to update their details.
  -> primary_goal: "profile"

- Scenario: User is just starting the chat with pleasantries, asking how the AI is doing, or sending casual greetings.
  -> primary_goal: "greeting"

- Scenario: User disagrees with a previous answer, says something is wrong, asks to repeat, or references a topic discussed just moments ago.
  -> primary_goal: "follow_up"
`;


```
