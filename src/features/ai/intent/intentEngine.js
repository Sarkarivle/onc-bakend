/**
 * IntentEngine Module (Architectural Version 15.0 - Expert Action Planner)
 * Responsibility: Sateek Goal identification with strict tool planning.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. NEURAL ROUTING (Near-Instant)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch && semanticMatch.confidence > 0.98) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        // 2. MASTER AI PLANNER (Hits qwen2.5:7b)
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

        const prompt = `
You are an AI Planner for Jobo AI. Analyze the user request and determine the actions needed.
Today's Date: ${istDate} | User: ${profile.name || 'User'}

# RULES:
- Never rely on keyword matching.
- Identify the Primary Goal (e.g., Find Jobs, Career Advice, Profile Info, Greeting).
- If fresh/factual info is needed, enable need_database.
- Use need_tools ONLY if specific calculations or job searches are required.

# EXAMPLES:
User: "top 5 sarkari job"
Output: {"primary_goal": "Retrieve latest top 5 government jobs", "need_database": true, "need_tools": ["job_search"]}

User: "hi"
Output: {"primary_goal": "Greet user and start conversation", "need_database": false, "directResponse": "Namaste! Kaise madad karun?"}

JSON ONLY:
{
  "primary_goal": "STRING",
  "need_memory": BOOLEAN,
  "need_search": BOOLEAN,
  "need_database": BOOLEAN,
  "need_tools": ["job_search" | "college_search" | "profile"],
  "need_clarification": BOOLEAN,
  "priority": "low|medium|high",
  "response_strategy": "Direct Answer | Search Database | Retrieve Memory",
  "directResponse": "Short Hinglish response (ONLY for Greetings/Profile)"
}`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (plan) {
                // Map goals back to system intents
                plan.intent = this._inferIntentFromGoal(plan, workingQuery);
                plan.execution = this._buildExecutionPlan(plan);
                plan.canAnswerInstantly = !plan.need_database && !plan.need_search && plan.directResponse;

                return this._attachCognitiveMap({ ...plan, ...normalized }, state);
            }
        } catch (error) {
            console.error("❌ Neural Planner Failure:", error.message);
        }

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    static _inferIntentFromGoal(plan, query) {
        const goal = (plan.primary_goal || "").toLowerCase();
        const q = query.toLowerCase();

        if (q.includes('job') || q.includes('naukri') || q.includes('vacancy') || goal.includes('job')) return 'JOB_SEARCH';
        if (q.includes('college') || goal.includes('college')) return 'COLLEGE';
        if (q.includes('resume') || goal.includes('resume')) return 'RESUME';
        if (q.includes('advice') || goal.includes('career') || goal.includes('roadmap')) return 'CAREER_GUIDANCE';

        return 'GENERAL';
    }

    static _buildExecutionPlan(plan) {
        const execution = [];
        if (plan.need_memory) execution.push({ step: 1, tool: "MEMORY", purpose: "Context" });
        if (plan.need_database || plan.need_search || plan.need_tools?.includes('job_search')) {
            execution.push({ step: 2, tool: "RAG", purpose: "Data Retrieval" });
        }
        return execution;
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            intent: "GENERAL",
            canAnswerInstantly: false,
            execution: [{ step: 1, tool: "LLM", purpose: "fallback" }]
        }, state);
    }

    static _normalizeQuery(query) {
        return { cleanedQuery: String(query || "").trim() };
    }

    static _attachCognitiveMap(contract, state = {}) {
        return {
            ...contract,
            cognitiveMap: {
                Intent: contract.intent || "GENERAL",
                Goal: contract.primary_goal,
                NeedsRAG: contract.need_database || contract.need_search,
                Confidence: contract.confidence || 0.9
            }
        };
    }
}

module.exports = IntentEngine;
