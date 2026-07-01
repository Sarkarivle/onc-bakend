/**
 * IntentEngine Module (Architectural Version 4.0 - Unified Cognitive Controller)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Planning, and Execution Strategy.
 * This replaces legacy rule-based detection with a Gemini-style unified planning call.
 */
const LLMProvider = require('../generation/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');

class IntentEngine {
    /**
     * Unified Cognitive Controller (UCC)
     * Performs Intent Detection, Query Refinement, and Tool Planning in a single LLM call.
     */
    static async classify(query, state = {}, profile = {}) {
        // 1. FAST PATH: Deterministic Check
        const fastMatch = DeterministicIntentResolver.resolve(query);
        if (fastMatch) {
            console.log(`[INTENT] Fast path hit: ${fastMatch.intent}`);
            return {
                ...fastMatch,
                refinedQuery: query,
                parallel: false,
                execution: [{ step: 1, tool: "LLM", purpose: "direct response" }]
            };
        }

        const prompt = `
Task: Act as the Cognitive Controller for Jobo AI.
Generate a high-precision Execution Plan for the following user request.

[USER QUERY]: "${query}"
[CONTEXT]: Topic: ${state.currentTopic || 'General'} | Turn: ${state.turnCount || 0}
[USER PROFILE]: ${JSON.stringify(profile)}

# COGNITIVE REQUIREMENTS:
1. INTENT: Detect primary and sub-intents (e.g., JOB_SEARCH, FIELD_DETAILS, CAREER_GUIDANCE, RESUME, SCHOLARSHIP).
2. REWRITE: If the query is vague or uses pronouns (e.g., "fees?", "uski link"), rewrite it using context into a full searchable query.
3. PLANNING: Decide if external tools are needed to fulfill the request.
4. PARALLELISM: Identify if multiple tools can be executed simultaneously for speed.

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
  "requiredContext": ["profile", "conversation"],
  "execution": [
    { "step": 1, "tool": "RAG|PROFILE|CALCULATOR", "purpose": "brief reason" },
    { "step": 2, "tool": "LLM", "purpose": "synthesis" }
  ],
  "reasoningShort": "1 sentence logic"
}

PLAN:`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);

            if (!plan || !plan.intent) throw new Error("Invalid Plan from LLM");

            // Normalize for backward compatibility with other modules
            return {
                ...plan,
                normalizedIntent: plan.intent,
                primaryIntent: plan.intent,
                refinedQuery: plan.refinedQuery || query,
                mode: plan.intent, // Mapping intent to mode for Planner/Orchestrator
                behavior: "RESPOND"
            };
        } catch (error) {
            console.error("❌ UCC Planning Failure:", error.message);
            return this._fallbackPlan(query);
        }
    }

    static _fallbackPlan(query) {
        return {
            intent: "GENERAL_QUERY",
            normalizedIntent: "GENERAL_QUERY",
            confidence: 0.5,
            refinedQuery: query,
            mode: "GENERAL_HELP",
            behavior: "RESPOND",
            parallel: false,
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }],
            reasoningShort: "Fallback due to planning error"
        };
    }
}

module.exports = IntentEngine;
