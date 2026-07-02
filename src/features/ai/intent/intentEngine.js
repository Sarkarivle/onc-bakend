/**
 * IntentEngine Module (Architectural Version 6.0 - Scalable Neural Controller)
 * Responsibility: Using Micro-LLMs (0.5B) for millisecond intent detection.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    /**
     * Neural Intent Controller
     * Uses qwen2.5:0.5b for ultra-fast, scalable classification.
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. FAST PATH: Deterministic Check (Exact match) - < 5ms
        const fastMatch = DeterministicIntentResolver.resolve(workingQuery);
        if (fastMatch) {
            return this._attachCognitiveMap({
                ...fastMatch,
                ...normalized,
                refinedQuery: fastMatch.refinedQuery || normalized.canonicalQuery,
                execution: fastMatch.execution || (fastMatch.intent === 'GREETING' ? [] : [{ step: 1, tool: "LLM", purpose: "direct response" }])
            }, state);
        }

        // 2. NEURAL ROUTER: Using Micro-LLM (0.5B) for Scalable Intelligence - < 500ms
        // This replaces Regex and provides Gemini-like flexibility.
        const prompt = `
Task: Detect Intent and Plan Tools.
Query: "${workingQuery}"
Context: Topic=${state.currentTopic || 'General'}
Profile: ${JSON.stringify(profile)}

Intents: JOB_SEARCH, FIELD_DETAILS, CAREER_GUIDANCE, RESUME, SCHOLARSHIP, CONTINUE.

JSON ONLY:
{
  "intent": "STRING",
  "confidence": 0.0-1.0,
  "refinedQuery": "Optimized search query",
  "execution": [{ "step": 1, "tool": "RAG|PROFILE|CALCULATOR|DATE_DIFF", "purpose": "reason" }],
  "reasoning": "Short logic"
}`;

        try {
            // This call now hits qwen2.5:0.5b (Fastest Neural Path)
            const plan = await LLMProvider.generateLogic(prompt);
            if (plan && plan.intent) {
                return this._attachCognitiveMap({
                    ...plan,
                    ...normalized,
                    behavior: plan.confidence < 0.6 ? "CLARIFY" : "RESPOND"
                }, state);
            }
        } catch (error) {
            console.error("❌ Neural Controller Failure:", error.message);
        }

        // 3. FALLBACK: Semantic Router (Vector Matching)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            intent: "GENERAL_QUERY",
            confidence: 0.5,
            ...normalized,
            refinedQuery: normalized.canonicalQuery || query,
            behavior: "RESPOND",
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }]
        }, state);
    }

    static _normalizeQuery(query) {
        const originalQuery = String(query || "");
        const cleanedQuery = originalQuery.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim();
        const canonicalQuery = cleanedQuery.toLowerCase().replace(/\bgovt\b/g, "government").trim();
        return { originalQuery, cleanedQuery, canonicalQuery, language: this._detectLanguage(cleanedQuery) };
    }

    static _detectLanguage(query) {
        if (/[\u0900-\u097F]/.test(query)) return "hi";
        if (/\b(kya|kaise|naukri|sarkari|hindi|hinglish)\b/i.test(query)) return "hi-en";
        return "en";
    }

    static _attachCognitiveMap(contract, state = {}) {
        const intent = contract.intent || "GENERAL_QUERY";
        const execution = Array.isArray(contract.execution) ? contract.execution : [];
        return {
            ...contract,
            cognitiveMap: {
                Intent: intent,
                Goal: contract.reasoning || `Handle ${intent}`,
                Context: { currentTopic: state.currentTopic || "GENERAL", turnCount: state.turnCount || 0 },
                Confidence: Number(contract.confidence || 0.5),
                NeedsRAG: execution.some(step => step.tool === 'RAG'),
                CanonicalQuery: contract.refinedQuery || contract.cleanedQuery
            }
        };
    }
}

module.exports = IntentEngine;
