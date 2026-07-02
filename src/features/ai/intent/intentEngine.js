/**
 * IntentEngine Module (Architectural Version 20.0 - Planner V2 High-Precision Controller)
 * Responsibility: Processing Planner V2 JSON schema and orchestrating multi-engine execution.
 * Preserves all business logic while adopting modern LLM Planner behavior.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');
const SemanticRouter = require('./SemanticRouter');
const plannerPrompt = require('./prompts/planner_prompt');

class IntentEngine {
    /**
     * classify: Tiered Planning.
     * Tier 1: Deterministic (Legacy Safety)
     * Tier 2: AI Planner V2 (Action-Oriented Strategy)
     */
    static async classify(query, state = {}, profile = {}) {
        const normalized = this._normalizeQuery(query);
        const workingQuery = normalized.cleanedQuery;

        // --- TIER 1: DETERMINISTIC ---
        const fastMatch = DeterministicIntentResolver.resolve(workingQuery);
        if (fastMatch) {
            // Map legacy response to V2 schema for consistency
            return this._attachCognitiveMap({
                version: "2.0",
                primary_goal: `Execute deterministic command: ${fastMatch.intent}`,
                goal_type: "task_execution",
                confidence: 1.0,
                priority: "medium",
                urgency: "normal",
                ...fastMatch,
                ...normalized
            }, state);
        }

        // --- TIER 2: AI PLANNER V2 (Modern Planner Architecture) ---
        const istDate = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(new Date());

        const prompt = plannerPrompt(istDate, profile.name || 'Dost');

        try {
            const plan = await LLMProvider.generateLogic(prompt + `\n\nUser: "${workingQuery}"\nOutput:`);
            if (plan) {
                // Backward compatibility: Map Planner Goal/Type back to system intent for formatting
                plan.intent = this._inferDownstreamIntent(plan, workingQuery);

                // Map V2 schema to internal execution steps
                plan.execution = this._buildExecutionArray(plan);

                // Short-circuit logic: True if no data retrieval or complex engines are needed
                plan.canAnswerInstantly = (
                    !plan.need_database &&
                    !plan.need_search &&
                    plan.next_engines?.length <= 1 &&
                    plan.next_engines?.includes('response_engine') &&
                    Boolean(plan.directResponse)
                );

                return this._attachCognitiveMap({ ...plan, ...normalized }, state);
            }
        } catch (error) {
            console.error("❌ Planner V2 Failure:", error.message);
        }

        // Tier 3: Semantic Fallback
        const semanticMatch = await SemanticRouter.route(workingQuery, state);
        if (semanticMatch) return this._attachCognitiveMap({ version: "2.0", ...semanticMatch, ...normalized }, state);

        return this._fallbackPlan(workingQuery, normalized, state);
    }

    /**
     * Maps the V2 Goal/Type to the system's internal template identifiers.
     */
    static _inferDownstreamIntent(plan, query) {
        const goal = (plan.primary_goal || "").toLowerCase();
        const goalType = (plan.goal_type || "").toLowerCase();
        const q = query.toLowerCase();

        if (goal.includes('job') || goal.includes('vacancy') || q.includes('naukri')) return 'JOB_SEARCH';
        if (goal.includes('college') || goal.includes('university') || q.includes('college')) return 'COLLEGE';
        if (goalType === 'profile_update' || goal.includes('profile') || q.includes('meri profile')) return 'PROFILE_QUERY';
        if (goal.includes('advice') || goal.includes('career') || goal.includes('roadmap')) return 'CAREER_GUIDANCE';
        if (goal.includes('resume') || goal.includes('cv')) return 'RESUME';

        return 'GENERAL';
    }

    /**
     * Translates Planner V2 engines and tools into execution steps.
     */
    static _buildExecutionArray(plan) {
        const execution = [];
        const engines = plan.next_engines || [];
        const tools = plan.need_tools || [];

        // 1. Context & Profile
        if (engines.includes('memory_engine') || plan.need_memory) {
            execution.push({ step: 1, tool: "MEMORY", purpose: plan.memory_action === 'update' ? "Update Profile" : "Read History" });
        }

        if (tools.includes('profile')) {
            execution.push({ step: 1, tool: "PROFILE", purpose: "Identity Verification" });
        }

        // 2. Data Retrieval (Search or Database)
        if (engines.includes('database_engine') || engines.includes('search_engine') || plan.need_database || plan.need_search) {
            execution.push({ step: 2, tool: "RAG", purpose: "Data Retrieval" });
        }

        // 3. Logic Tools
        if (tools.includes('date_diff')) {
            execution.push({ step: 2, tool: "DATE_DIFF", purpose: "Calculate Deadline" });
        }

        return execution;
    }

    static _fallbackPlan(query, normalized = {}, state = {}) {
        return this._attachCognitiveMap({
            version: "2.0",
            primary_goal: "Fallback response",
            intent: "GENERAL",
            canAnswerInstantly: false,
            execution: [{ step: 1, tool: "LLM", purpose: "Fallback" }]
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
                Version: contract.version || "2.0",
                Intent: contract.intent || "GENERAL",
                Goal: contract.primary_goal || "Respond to user",
                GoalType: contract.goal_type || "chat",
                ExecutionMode: contract.execution_mode || "sequential",
                Priority: contract.priority || "medium",
                Urgency: contract.urgency || "normal",
                NeedsRAG: Boolean(contract.need_database || contract.need_search)
            }
        };
    }
}

module.exports = IntentEngine;
