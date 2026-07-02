/**
 * IntentEngine Module (Architectural Version 4.0 - Unified Cognitive Controller)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Planning, and Execution Strategy.
 * This replaces legacy rule-based detection with a Gemini-style unified planning call.
 */
/**
 * IntentEngine Module (Architectural Version 5.0 - Cognitive Controller)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Planning, and Execution Strategy.
 */
const LLMProvider = require('../generation/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');

class IntentEngine {
    /**
     * Unified Cognitive Controller (UCC)
     * Performs Intent Detection, Query Refinement, and Tool Planning in a single LLM call.
     */
    static async classify(query, state = {}, profile = {}) {
        // 1. FAST PATH: Deterministic Check (For Greetings/Safety/Garbage/Common Jobs)
        const fastMatch = DeterministicIntentResolver.resolve(query);
        if (fastMatch) {
            return {
                ...fastMatch,
                refinedQuery: fastMatch.refinedQuery || query,
                execution: fastMatch.execution || (fastMatch.intent === 'GREETING' ? [] : [{ step: 1, tool: "LLM", purpose: "direct response" }])
            };
        }

        const prompt = `
Task: Act as the Cognitive Controller for Jobo AI.
Analyze the user request and generate a high-precision Execution Plan.

[USER QUERY]: "${query}"
[CONTEXT]: Topic: ${state.currentTopic || 'General'} | Turn: ${state.turnCount || 0}
[USER PROFILE]: ${JSON.stringify(profile)}

# COGNITIVE REQUIREMENTS:
1. UNDERSTAND: Extract the true goal of the user.
2. INTENT: Detect primary intent (JOB_SEARCH, FIELD_DETAILS, CAREER_GUIDANCE, RESUME, SCHOLARSHIP, RESULT_CHECK).
3. REWRITE: If query is vague, rewrite it into a full searchable query using context.
4. PLANNING: Decide if external tools (RAG, PROFILE, CALCULATOR) are needed.
5. CONFIDENCE: Score your plan from 0.0 to 1.0.
6. CLARIFICATION: If intent is too vague (<0.6 confidence), decide to ask for clarification.

# AVAILABLE TOOLS:
- RAG: Search the Job/Scholarship Database for verified updates.
- PROFILE: Access user's deep profile context (Qualification, DOB, Category).
- CALCULATOR: Perform mathematical operations or age calculations.
- LLM: The final synthesis tool (always required).

# OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "intent": "STRING",
  "confidence": 0.0-1.0,
  "refinedQuery": "STRING",
  "needsPlanning": BOOLEAN,
  "parallel": BOOLEAN,
  "shouldClarify": BOOLEAN,
  "requiredContext": ["profile", "conversation"],
  "execution": [
    { "step": 1, "tool": "RAG|PROFILE|CALCULATOR", "purpose": "reason" },
    { "step": 2, "tool": "LLM", "purpose": "synthesis" }
  ],
  "reasoning": "1 sentence logic"
}

PLAN:`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (!plan || !plan.intent) throw new Error("Invalid Plan from LLM");

            return {
                ...plan,
                behavior: plan.shouldClarify ? "CLARIFY" : "RESPOND"
            };
        } catch (error) {
            console.error("❌ Cognitive Controller Failure:", error.message);
            return this._fallbackPlan(query);
        }
    }

    static _fallbackPlan(query) {
        return {
            intent: "GENERAL_QUERY",
            confidence: 0.5,
            refinedQuery: query,
            behavior: "RESPOND",
            parallel: false,
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }],
            reasoning: "Fallback due to planning error"
        };
    }
}

module.exports = IntentEngine;
