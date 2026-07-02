/**
 * IntentEngine Module (Architectural Version 11.0 - Pure Neural Planner)
 * Responsibility: Logical decomposition of user requests without keywords.
 * Uses tiered Semantic Routing + Logic Model for scaling.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    /**
     * Decomposes query into a Task Execution Plan.
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. NEURAL ROUTING (Vector Similarity) - Fast & Scalable (< 100ms)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch && semanticMatch.confidence > 0.92) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        // 2. LOGIC PLANNER (Hits qwen2.5:7b for Task Decomposition)
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

        const prompt = `
Task: Act as the Task Planner for Jobo AI.
Context: Date=${istDate} | Profile=${JSON.stringify(profile)} | Topic=${state.currentTopic || 'General'}

Goal: Decompose user query into logical tool calls.

# SYSTEM ABILITIES:
- RAG: Access database for jobs, exams, notifications, and factual data.
- PROFILE: Access user's stored identity and goals.
- DATE_DIFF: Calculate precise days between two dates.
- LLM: For general chat and synthesis.

# PLANNING LOGIC:
- If user wants a list, top items, or new updates -> Plan 'RAG'.
- If user asks about themselves -> Plan 'PROFILE'.
- If query is pure conversation -> Plan 'LLM'.

JSON ONLY:
{
  "intent": "STRING",
  "confidence": 0.0-1.0,
  "canAnswerInstantly": BOOLEAN,
  "directResponse": "Brotherly Hinglish (only if canAnswerInstantly is true)",
  "execution": [
    { "step": 1, "tool": "RAG|PROFILE|DATE_DIFF", "purpose": "reasoning" }
  ],
  "reasoning": "Logical derivation for this plan"
}`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (plan && plan.intent) {
                return this._attachCognitiveMap({ ...plan, ...normalized }, state);
            }
        } catch (error) {
            console.error("❌ Neural Planner Failure:", error.message);
        }

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            intent: "GENERAL_QUERY",
            canAnswerInstantly: false,
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }]
        }, state);
    }

    static _normalizeQuery(query) {
        return {
            cleanedQuery: String(query || "").replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim()
        };
    }

    static _attachCognitiveMap(contract, state = {}) {
        const execution = Array.isArray(contract.execution) ? contract.execution : [];
        return {
            ...contract,
            cognitiveMap: {
                Intent: contract.intent,
                CanAnswerInstantly: Boolean(contract.canAnswerInstantly),
                NeedsRAG: execution.some(s => s.tool === 'RAG'),
                Plan: execution
            }
        };
    }
}

module.exports = IntentEngine;
