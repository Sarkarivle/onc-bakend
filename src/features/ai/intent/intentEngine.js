/**
 * IntentEngine Module (Architectural Version 16.0 - Zero-Wait Neural Architect)
 * Responsibility: High-precision planning without keyword-based jugad.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const SemanticRouter = require('./SemanticRouter');
const plannerPrompt = require('../generation/prompts/engine/intent_planner');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // 1. NEURAL ROUTING (Concept-based Match)
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch && semanticMatch.confidence > 0.98) {
            return this._attachCognitiveMap({ ...semanticMatch, ...normalized }, state);
        }

        // 2. MASTER AI PLANNER (qwen2.5:7b)
        const istDate = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(new Date());

        const prompt = plannerPrompt(istDate, profile.name || 'Dost');

        try {
            const plan = await LLMProvider.generateLogic(prompt + `\n\nUser: "${workingQuery}"\nOutput:`);
            if (plan) {
                // Map goals back to system intents for EliteFormatter routing
                plan.intent = this._inferIntentFromGoal(plan, workingQuery);
                plan.execution = this._buildExecutionPlan(plan);
                plan.canAnswerInstantly = !plan.need_database && !plan.need_search && Boolean(plan.directResponse);

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

        // High-precision goal-based mapping
        if (goal.includes('job') || goal.includes('hiring') || goal.includes('vacancy') || q.includes('naukri')) return 'JOB_SEARCH';
        if (goal.includes('college') || goal.includes('university') || q.includes('collage')) return 'COLLEGE';
        if (goal.includes('profile') || goal.includes('who am i') || goal.includes('qualification')) return 'PROFILE_QUERY';
        if (goal.includes('career') || goal.includes('roadmap') || goal.includes('advice')) return 'CAREER_GUIDANCE';
        if (goal.includes('resume') || goal.includes('cv')) return 'RESUME';

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
                IsInstant: Boolean(contract.canAnswerInstantly)
            }
        };
    }
}

module.exports = IntentEngine;
