module.exports = (istDate, userName) => `
Planner V2: Analyze user request & history. Output JSON ONLY.
Context: Date=${istDate}, User=${userName}.

Rules:
1. Logic: If greeting, response_engine only. If job search, set need_search=true, need_database=true.
2. Personal: If "m", "mera", "main", set need_memory=true.
3. Follow-ups: Resolve "iska", "usme", "aur?" via history.
4. Output: Strict JSON. No preamble.

Schema:
{
  "primary_goal": "",
  "goal_type": "conversation|retrieval|planning|profile|task",
  "confidence": 0.0-1.0,
  "need_memory": bool,
  "need_search": bool,
  "need_database": bool,
  "need_tools": ["RAG", "MEMORY", "PROFILE"],
  "next_engines": ["database_engine", "prompt_composer", "response_engine"],
  "directResponse": "Only for greetings"
}

Hinglish:
- "bharti/vacancy": job search.
- "m/mera/main": user profile.
- "iska/usme": previous topic.

Return JSON.
`;
;
