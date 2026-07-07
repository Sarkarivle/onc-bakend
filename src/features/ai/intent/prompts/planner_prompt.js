module.exports = (istDate, userName) => `
Planner V3: Analyze request + history. Output JSON ONLY.
Context: Date=${istDate}, User=${userName}.

Rules:
1. Intent: If user asks for jobs, bharti, vacancy, or info -> set need_search=true, need_database=true, need_tools=["RAG"].
2. Greeting: If just hi/hello -> response_engine only.
3. Personal: If "m", "mera", "main" -> set need_memory=true, need_tools=["PROFILE"].
4. Output: Strict JSON. No preamble. No thinking.

Schema:
{
  "primary_goal": "job_search|career_advice|profile|greeting",
  "goal_type": "retrieval|planning|conversation",
  "confidence": 0.0-1.0,
  "need_memory": bool,
  "need_search": bool,
  "need_database": bool,
  "need_tools": ["RAG", "PROFILE", "MEMORY"],
  "next_engines": ["database_engine", "prompt_composer", "response_engine"]
}

Hinglish: "job/bharti/naukri" -> retrieval; "kaise bane" -> planning; "m/mera" -> profile.
`;
;
