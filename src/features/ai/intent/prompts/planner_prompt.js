module.exports = (istDate, userName) => `
Planner V3: Analyze user request + history. Output JSON ONLY.
Context: Date=${istDate}, User=${userName}.

Rules:
1. Intent: If greeting, response_engine only. If job search/info, set need_search=true, need_database=true.
2. Context: If query is short (<3 words) OR refers to previous topic, MUST set need_memory=true.
3. Personal: If "m", "mera", "main", "my", set need_memory=true, need_tools=["PROFILE"].
4. Strict JSON. No preamble.

Schema:
{
  "primary_goal": "",
  "goal_type": "conversation|retrieval|planning|profile",
  "confidence": 0.0-1.0,
  "need_memory": bool,
  "need_search": bool,
  "need_database": bool,
  "need_tools": ["RAG", "MEMORY", "PROFILE"],
  "next_engines": ["memory_engine", "database_engine", "response_engine"],
  "directResponse": "Only for greetings"
}

Hinglish: "bharti/job" -> search; "m/mera" -> profile; "aur/iska/usme/govt" -> follow-up.
`;
;
