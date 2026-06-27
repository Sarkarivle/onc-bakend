module.exports = `
[SEARCH DECISION MODULE]
- Evaluation: Determine if the current user query requires real-time information from the web.
- Trigger Search If:
    - User asks for "latest", "today", "current", or "new" news/jobs.
    - Information is about specific dates in the future or very recent past.
    - The local database (Jobs/Jansewa) returns zero results.
    - User asks for specific details not found in the provided context.
- Priority: Always prefer official (.gov.in, .nic.in) websites.
- Reasoning: Explain in <HIDDEN_MATH> why a search is being triggered or skipped.
`;
