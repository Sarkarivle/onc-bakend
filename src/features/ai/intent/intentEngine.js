/**
 * IntentEngine Module (Architectural Version 12.0 - Strict Neural Planner)
 * Responsibility: Logical decomposition with strict intent normalization.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. NEURAL ROUTING (Fast Path)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch && semanticMatch.confidence > 0.95) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        // 2. STRICT NEURAL ARCHITECT (Hits qwen2.5:7b)
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

        const prompt = `
Task: Act as the Task Planner for Jobo AI.
Date: ${istDate} | User: ${profile.name || 'User'}

Goal: Categorize user query into EXACT intent names.

# ALLOWED INTENTS:
- JOB_SEARCH: Finding vacancies, lists, or new hiring.
- FIELD_DETAILS: Asking about fees, dates, or salary of a job.
- CAREER_GUIDANCE: Advice or roadmaps.
- PROFILE_QUERY: Asking about user's own data (age, qualification).
- GENERAL: Greetings or casual chat.

# LOGIC:
- If user wants a "list" or "top 5" -> ALWAYS use JOB_SEARCH.
- Return ONLY the allowed intent name.

JSON ONLY:
{
  "intent": "JOB_SEARCH | FIELD_DETAILS | CAREER_GUIDANCE | PROFILE_QUERY | GENERAL",
  "confidence": 0.0-1.0,
  "canAnswerInstantly": BOOLEAN,
  "directResponse": "Brotherly Hinglish (only if canAnswerInstantly is true)",
  "refinedQuery": "Short searchable keywords (e.g., 'latest graduate sarkari jobs')",
  "execution": [{ "step": 1, "tool": "RAG|PROFILE", "purpose": "reason" }]
}`;

        try {
            const rawPlan = await LLMProvider.generateLogic(prompt);
            if (rawPlan) {
                // FORCE NORMALIZATION: Prevents LLM from inventing new names like "General information"
                rawPlan.intent = this._normalizeIntentName(rawPlan.intent, workingQuery);
                return this._attachCognitiveMap({ ...rawPlan, ...normalized }, state);
            }
        } catch (error) {
            console.error("❌ Neural Planner Failure:", error.message);
        }

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    static _normalizeIntentName(intent, query) {
        const name = String(intent || '').toUpperCase();
        const q = query.toLowerCase();

        // Safety override for high-priority keywords
        if (q.includes('list') || q.includes('top') || q.includes('job') || q.includes('naukri')) return 'JOB_SEARCH';

        if (name.includes('JOB') || name.includes('VACANCY')) return 'JOB_SEARCH';
        if (name.includes('CAREER') || name.includes('GUIDE')) return 'CAREER_GUIDANCE';
        if (name.includes('PROFILE') || name.includes('ME')) return 'PROFILE_QUERY';
        if (name.includes('FEES') || name.includes('DETAIL')) return 'FIELD_DETAILS';

        return 'GENERAL';
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            intent: "GENERAL",
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
                NeedsRAG: execution.some(s => s.tool === 'RAG') || contract.intent === 'JOB_SEARCH'
            }
        };
    }
}

module.exports = IntentEngine;
