/**
 * IntentEngine Module (Architectural Version 8.0 - Master Architect)
 * Responsibility: Routing queries to either Instant Response or Full Execution Path.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');

class IntentEngine {
    /**
     * The Master Architect call.
     * Decides if the query needs external data or can be answered instantly.
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. HARDCODED SAFETY (1ms)
        const fastMatch = DeterministicIntentResolver.resolve(workingQuery);
        if (fastMatch) return this._attachCognitiveMap({ ...fastMatch, ...normalized }, state);

        // 2. NEURAL ARCHITECT (Hits qwen2.5:7b for Intelligence + Speed)
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

        const prompt = `
Task: Act as the Master Architect for Jobo AI.
Date: ${istDate} (Today)
User Profile: ${JSON.stringify(profile)}
History: ${JSON.stringify((state.history || []).slice(-2))}

Goal: Decide if this needs Database Search (RAG) or can be answered INSTANTLY.

Intents:
- JOB_SEARCH: Factual data needed from database.
- PROFILE_QUERY: Asking about user's own data.
- GENERAL_TALK: Greetings, personality questions, feelings.
- CAREER_ADVICE: High-level guidance.

# LOGIC RULES:
1. If user says "Hi", "Hello", "Kaise ho", "Who are you" -> Respond INSTANTLY in 'directResponse'.
2. If user asks about their profile (Age, Qual) -> Respond INSTANTLY using provided Profile.
3. If user wants jobs or specific facts -> Plan 'RAG' tool.

JSON ONLY:
{
  "intent": "STRING",
  "canAnswerInstantly": BOOLEAN,
  "directResponse": "Provide answer ONLY if canAnswerInstantly is true (In Brotherly Hinglish)",
  "execution": [
    { "step": 1, "tool": "RAG|DATE_DIFF|CALCULATOR", "purpose": "needed for complex queries" }
  ],
  "reasoning": "Why this path?"
}`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (plan && plan.intent) {
                return this._attachCognitiveMap({
                    ...plan,
                    ...normalized
                }, state);
            }
        } catch (error) {
            console.error("❌ Architect Logic Failure:", error.message);
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
        return {
            ...contract,
            cognitiveMap: {
                Intent: contract.intent || "GENERAL",
                CanAnswerInstantly: Boolean(contract.canAnswerInstantly),
                NeedsRAG: (contract.execution || []).some(s => s.tool === 'RAG'),
                CanonicalQuery: contract.cleanedQuery
            }
        };
    }
}

module.exports = IntentEngine;
