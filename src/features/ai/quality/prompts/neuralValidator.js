/**
 * Prompt for NeuralValidator Task (Phase 5)
 */
module.exports = (query, draft, context) => `
Task: Quality Audit for Jobo AI Agent.
Verify if the draft answer is accurate, safe, and professional.

[USER QUERY]: "${query}"
[VERIFIED DATA (GROUND TRUTH)]:
${context.jobs || "No database records found."}
${context.web || "No web search data found."}

[AI DRAFT ANSWER]:
"${draft}"

Instructions for Evaluation:
1. HALLUCINATION CHECK: Does the draft mention specific dates, salaries, or links NOT present in the [VERIFIED DATA]?
2. RELEVANCE: Does it actually answer the user's specific question?
3. LANGUAGE: is it natural Hinglish?
4. SAFETY: Does it leak internal logic (e.g., mentions "planner", "vector", "json")?

Return ONLY this JSON format:
{
  "passed": true | false,
  "score": 0 to 100,
  "issues": ["Issue 1", "Issue 2"],
  "repairInstruction": "Specific instruction for the AI to fix the answer if passed is false."
}

Note: If no verified data is available, the AI should NOT invent facts. Saying "Maaf kijiye, verified jankari nahi mili" is a PASS.`;
