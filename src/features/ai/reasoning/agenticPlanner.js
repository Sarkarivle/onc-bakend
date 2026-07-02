/**
 * AgenticPlanner Module (Architectural Version 4.0)
 * Responsibility: Consuming the Unified Cognitive Plan.
 * This module no longer contains hardcoded "if/else" tool selection.
 */
class AgenticPlanner {
    /**
     * Strategic Wrapper for the UCC Plan.
     * Simply prepares the final strategy object for the Orchestrator.
     */
    static async generatePlan(query, contract, context = {}) {
        const mode = contract.mode || contract.intent;
        const execution = Array.isArray(contract.execution) ? contract.execution : this._defaultExecutionForMode(mode);
        const tools = execution.map(e => e.tool).filter(Boolean);
        const needsDatabase = execution.some(e => e.tool === 'RAG' || e.tool === 'DATABASE') || ['JOB_SEARCH', 'JOB_DETAILS'].includes(mode);
        const needsMemory = execution.some(e => e.tool === 'MEMORY');
        const needsTool = execution.some(e => !['LLM'].includes(e.tool));

        return {
            ...contract,
            mode,
            behavior: contract.behavior || "RESPOND",
            intent: contract.normalizedIntent || contract.intent,
            refinedQuery: contract.refinedQuery || contract.canonicalQuery || query,
            tools,
            needsDatabase,
            needsMemory,
            needsRAG: needsDatabase,
            needsTool,
            parallel: contract.parallel || false,
            execution,
            priorityModules: ["CORE", "PERSONALITY", contract.intent].filter(Boolean),
            useReasoningModel: contract.intent === "CAREER_GUIDANCE",
            emotionalTone: "NEUTRAL",
            stopOnFailure: false,
            planner: {
                name: "AgenticPlanner",
                confidence: contract.confidence || 0.5,
                generatedAt: new Date().toISOString()
            }
        };
    }

    static _defaultExecutionForMode(mode) {
        if (['JOB_SEARCH', 'JOB_DETAILS'].includes(mode)) {
            return [{ step: 1, tool: 'RAG', purpose: 'database retrieval' }, { step: 2, tool: 'LLM', purpose: 'synthesis' }];
        }
        if (mode === 'PROFILE_CHECK' || mode === 'PROFILE_HELP') {
            return [{ step: 1, tool: 'PROFILE', purpose: 'profile lookup' }, { step: 2, tool: 'LLM', purpose: 'synthesis' }];
        }
        return [{ step: 1, tool: 'LLM', purpose: 'direct response' }];
    }
}

module.exports = AgenticPlanner;
