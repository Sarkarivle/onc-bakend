/**
 * IntentEngine Module (Architectural Version 14.0 - Advanced Action-Oriented Planner)
 * Responsibility: Pure goal-based planning. Categories are inferred from goals.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const SemanticRouter = require('./SemanticRouter');

class IntentEngine {
    /**
     * Goal-Oriented Planner Call.
     * Decides strategy and tool execution based on primary objective.
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. NEURAL ROUTING (Semantic Short-circuit)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch && semanticMatch.confidence > 0.98) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        // 2. MASTER AI PLANNER (Hits qwen2.5:7b)
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

        const prompt = `
You are an AI Planner, not an intent classifier.
Your job is NOT to assign a fixed intent label. Instead, analyze the message and determine the goal.
Date: ${istDate} | User: ${profile.name || 'User'}

# Rules:
- Never rely on keyword matching.
- Think in terms of actions, not categories.
- If fresh/factual info is needed (Jobs/Colleges/Dates), enable need_database.

JSON ONLY:
{
  "primary_goal": "STRING",
  "secondary_goals": [],
  "need_memory": BOOLEAN,
  "need_search": BOOLEAN,
  "need_database": BOOLEAN,
  "need_tools": ["job_search" | "college_search" | "date_diff" | "profile"],
  "need_clarification": BOOLEAN,
  "clarification_question": "STRING",
  "priority": "low|medium|high",
  "response_strategy": "Direct Answer | Search First | Retrieve Memory | Ask Question | Use Tool",
  "directResponse": "Brotherly Hinglish (ONLY if no search/database/tools are needed)"
}`;

        try {
            const plan = await LLMProvider.generateLogic(prompt);
            if (plan) {
                // Adapt goal-oriented plan back to system intent mapping for response templates
                plan.intent = this._inferIntentFromGoal(plan);
                plan.execution = this._buildExecutionPlan(plan);
                plan.canAnswerInstantly = !plan.need_database && !plan.need_search && plan.directResponse;

                return this._attachCognitiveMap({ ...plan, ...normalized }, state);
            }
        } catch (error) {
            console.error("❌ Neural Planner Failure:", error.message);
        }

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    /**
     * Maps action-oriented goals back to template intents for UI formatting.
     */
    static _inferIntentFromGoal(plan) {
        const goal = plan.primary_goal.toLowerCase();
        const tools = plan.need_tools || [];

        if (tools.includes('job_search') || goal.includes('job') || goal.includes('naukri') || goal.includes('vacancy')) return 'JOB_SEARCH';
        if (tools.includes('college_search') || goal.includes('college') || goal.includes('university')) return 'COLLEGE';
        if (goal.includes('profile') || goal.includes('my age') || goal.includes('qualification')) return 'PROFILE_QUERY';
        if (goal.includes('resume') || goal.includes('cv')) return 'RESUME';
        if (goal.includes('advice') || goal.includes('career') || goal.includes('roadmap')) return 'CAREER_GUIDANCE';
        if (goal.includes('hi') || goal.includes('greet')) return 'GENERAL';

        return 'GENERAL';
    }

    static _buildExecutionPlan(plan) {
        const execution = [];
        if (plan.need_memory) execution.push({ step: 1, tool: "MEMORY", purpose: "Context" });
        if (plan.need_database || plan.need_search) {
            execution.push({ step: 2, tool: "RAG", purpose: "Data Retrieval" });
        }
        if (plan.need_tools?.includes('date_diff')) {
            execution.push({ step: 2, tool: "DATE_DIFF", purpose: "Calculation" });
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
        return {
            cleanedQuery: String(query || "").replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim()
        };
    }

    static _attachCognitiveMap(contract, state = {}) {
        return {
            ...contract,
            cognitiveMap: {
                Intent: contract.intent || "GENERAL",
                Goal: contract.primary_goal,
                NeedsRAG: contract.need_database || contract.need_search,
                Confidence: contract.confidence || 0.9,
                CanonicalQuery: contract.cleanedQuery
            }
        };
    }
}

module.exports = IntentEngine;
