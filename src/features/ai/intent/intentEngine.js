/**
 * IntentEngine Module (Architectural Version 4.0 - Unified Cognitive Controller)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Planning, and Execution Strategy.
 * This replaces legacy rule-based detection with a Gemini-style unified planning call.
 */
/**
 * IntentEngine Module (Architectural Version 5.0 - Cognitive Controller)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Planning, and Execution Strategy.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    /**
     * Unified Cognitive Controller (UCC)
     * Performs Intent Detection, Query Refinement, and Tool Planning in a single LLM call.
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. FAST PATH: Deterministic Check (Exact match/Keywords)
        const fastMatch = DeterministicIntentResolver.resolve(workingQuery);
        if (fastMatch) {
            return this._attachCognitiveMap({
                ...fastMatch,
                ...normalized,
                refinedQuery: fastMatch.refinedQuery || normalized.canonicalQuery,
                execution: fastMatch.execution || (fastMatch.intent === 'GREETING' ? [] : [{ step: 1, tool: "LLM", purpose: "direct response" }])
            }, state);
        }

        // 2. TURBO PATH: Semantic Router (Local Vector Matching)
        // This bypasses the Intent LLM Call (Saves 2-3 seconds)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch) {
            return this._attachCognitiveMap({
                ...semanticMatch,
                ...normalized,
                refinedQuery: normalized.canonicalQuery,
                behavior: "RESPOND",
                reasoning: "⚡ Fast Semantic Intelligence"
            }, state);
        }

        const prompt = `
Task: Act as the Cognitive Controller for Jobo AI.
Analyze the user request and generate a high-precision Execution Plan.

[USER QUERY]: "${workingQuery}"
[CONTEXT]: Topic: ${state.currentTopic || 'General'} | Turn: ${state.turnCount || 0}
[USER PROFILE]: ${JSON.stringify(profile)}

# COGNITIVE REQUIREMENTS:
1. UNDERSTAND: Extract true goal.
2. INTENT: Detect primary (JOB_SEARCH, FIELD_DETAILS, CAREER_GUIDANCE, RESUME, SCHOLARSHIP, RESULT_CHECK).
3. REWRITE: If vague, rewrite into searchable query using context.
4. PLANNING: Decide if external tools (RAG, PROFILE, CALCULATOR, DATE_DIFF) are needed. Use DATE_DIFF if the query involves job deadlines or calculating remaining days.
5. CONFIDENCE: Score 0.0 to 1.0.
6. CLARIFICATION: If intent is vague (<0.6), decide to clarify.

# OUTPUT SCHEMA (JSON ONLY):
{
  "intent": "STRING",
  "confidence": 0.0-1.0,
  "refinedQuery": "STRING",
  "needsPlanning": BOOLEAN,
  "execution": [
    { "step": 1, "tool": "RAG|PROFILE|CALCULATOR|DATE_DIFF", "purpose": "reason" },
    { "step": 2, "tool": "LLM", "purpose": "synthesis" }
  ],
  "reasoning": "1 sentence"
}

PLAN:`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (!plan || !plan.intent) throw new Error("Invalid Plan from LLM");

            return this._attachCognitiveMap({
                ...plan,
                ...normalized,
                behavior: plan.shouldClarify ? "CLARIFY" : "RESPOND"
            }, state);
        } catch (error) {
            console.error("❌ Cognitive Controller Failure:", error.message);
            return this._fallbackPlan(workingQuery, normalized, state);
        }
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            intent: "GENERAL_QUERY",
            confidence: 0.5,
            ...normalized,
            refinedQuery: normalized.canonicalQuery || query,
            behavior: "RESPOND",
            parallel: false,
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }],
            reasoning: "Fallback due to planning error"
        }, state);
    }

    static _normalizeQuery(query) {
        const originalQuery = String(query || "");
        const cleanedQuery = originalQuery
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const canonicalQuery = cleanedQuery
            .toLowerCase()
            .replace(/\bgovt\b/g, "government")
            .replace(/\bsarkari naukri\b/g, "government jobs")
            .replace(/\bjobz\b/g, "jobs")
            .trim();

        return {
            originalQuery,
            cleanedQuery,
            canonicalQuery,
            language: this._detectLanguage(cleanedQuery)
        };
    }

    static _detectLanguage(query) {
        if (/[\u0900-\u097F]/.test(query)) return "hi";
        if (/\b(kya|kaise|mujhe|batao|bhai|naukri|sarkari|hindi|hinglish)\b/i.test(query)) return "hi-en";
        return "en";
    }

    static _attachCognitiveMap(contract, state = {}) {
        const intent = contract.intent || contract.normalizedIntent || "GENERAL_QUERY";
        const execution = Array.isArray(contract.execution) ? contract.execution : [];
        const needsTool = execution.some(step => !['LLM'].includes(String(step.tool || '').toUpperCase()));
        const needsRAG = execution.some(step => String(step.tool || '').toUpperCase() === 'RAG');
        const needsMemory = execution.some(step => String(step.tool || '').toUpperCase() === 'MEMORY');

        return {
            ...contract,
            cognitiveMap: {
                Intent: intent,
                Goal: contract.goal || contract.reasoningShort || contract.reasoning || `Handle ${intent}`,
                Domain: contract.domain || this._domainForIntent(intent),
                Subdomain: contract.subdomain || contract.mode || "GENERAL",
                Topic: contract.topic || state.currentTopic || state.topic || "GENERAL",
                Entities: contract.entities || contract.slots || {},
                Language: contract.language || "en",
                Context: {
                    currentTopic: state.currentTopic || state.topic || "GENERAL",
                    turnCount: state.turnCount || 0,
                    pendingAction: state.pendingAction || null
                },
                Conversation: {
                    isFollowUp: Boolean(state.history?.length),
                    historyCount: state.history?.length || 0
                },
                Confidence: Number(contract.confidence || 0.5),
                NeedsMemory: needsMemory,
                NeedsSearch: Boolean(needsRAG || contract.needsSearch),
                NeedsDatabase: Boolean(needsRAG || contract.needsDatabase),
                NeedsRAG: needsRAG,
                NeedsTool: needsTool,
                NeedsReasoning: Boolean(contract.needsPlanning !== false || intent === 'CAREER_GUIDANCE'),
                Ambiguous: Boolean(contract.needsClarification || contract.behavior === 'CLARIFY'),
                CanonicalQuery: contract.canonicalQuery || contract.refinedQuery || contract.cleanedQuery
            }
        };
    }

    static _domainForIntent(intent) {
        if (['JOB_SEARCH', 'FIELD_DETAILS', 'DISCOVERY', 'RESULT_ADMIT_CARD'].includes(intent)) return "GOVERNMENT_JOBS";
        if (['CAREER_GUIDANCE', 'MOTIVATION', 'INTERVIEW', 'SKILLS', 'RESUME'].includes(intent)) return "CAREER_GUIDANCE";
        if (intent === 'SCHOLARSHIP') return "SCHOLARSHIPS";
        return "GENERAL_STUDENT_HELP";
    }
}

module.exports = IntentEngine;
