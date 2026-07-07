/**
 * AgenticPlanner Module (Architectural Version 15.0 - Hybrid Bridge)
 * Responsibility: Finalizing the execution strategy based on Intent Engine's contract.
 * Bridges the gap between pure intent classification and multi-tool execution.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const plannerPrompt = require('../intent/prompts/planner_prompt');

class AgenticPlanner {
    /**
     * Generates or refines an execution plan.
     * @param {string} query - The user's message.
     * @param {Object} intentContract - The output from IntentEngine.
     * @param {Object} context - Session and Profile context.
     */
    static async generatePlan(query, intentContract, context = {}) {
        // --- BRIDGE LOGIC: If IntentEngine (V20) already provided a full plan, respect it ---
        if (intentContract && intentContract.version === "2.0") {
            const plan = {
                ...intentContract,
                reasoning: "⚡ Fast Semantic Intelligence",
                needsPlanning: false
            };
            // Ensure consistency in RAG flag
            plan.needsRAG = plan.needsRAG || plan.need_database || plan.need_search;
            return plan;
        }

        // --- FALLBACK: Legacy/Complex Planning via LLM ---
        const istDate = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
        }).format(new Date());

        const historyText = (context.state?.history || [])
            .slice(-5)
            .map(h => `User: ${h.user}\nAI: ${h.assistant}`)
            .join('\n---\n');

        const systemPrompt = plannerPrompt(istDate, context.profile?.name || 'Dost', historyText);

        try {
            // If the intent is already known but needs tool refinement
            const refinedPlan = await LLMProvider.generateLogic(
                `${systemPrompt}\n\nExisting Intent: ${intentContract.intent || 'GENERAL'}\nUser Query: "${query}"\n\nCreate refined plan JSON:`
            );

            if (refinedPlan) {
                return {
                    ...intentContract,
                    ...refinedPlan,
                    reasoning: "🧠 Neural Agentic Planning"
                };
            }
        } catch (error) {
            console.error("❌ Planner Fallback Failure:", error.message);
        }

        // --- CRITICAL FAILSAFE: Standard Default Plans ---
        return this._getDefaultPlan(intentContract, query);
    }

    static _getDefaultPlan(contract, query) {
        const intent = contract.intent || 'GENERAL';
        const needsRAG = ['JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'DISCOVERY'].includes(intent);

        return {
            ...contract,
            primary_goal: "Provide helpful response",
            goal_type: "question_answering",
            needsRAG,
            need_search: needsRAG,
            need_database: needsRAG,
            execution: needsRAG
                ? [{ step: 1, tool: "RAG", purpose: "retrieval" }]
                : [{ step: 1, tool: "LLM", purpose: "direct answer" }],
            reasoning: "⚠️ Failsafe Default Plan"
        };
    }
}

module.exports = AgenticPlanner;
