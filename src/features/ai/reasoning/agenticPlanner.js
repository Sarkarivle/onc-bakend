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
        // All rule-based routing removed.
        // We now extract the strategy directly from the Semantic Contract (UCC).

        return {
            mode: contract.mode || contract.intent,
            behavior: contract.behavior || "RESPOND",
            intent: contract.normalizedIntent || contract.intent,
            tools: contract.execution ? contract.execution.map(e => e.tool) : [],
            needsDatabase: contract.execution ? contract.execution.some(e => e.tool === 'RAG') : false,
            parallel: contract.parallel || false,
            execution: contract.execution || [],
            priorityModules: ["CORE", "PERSONALITY", contract.intent].filter(Boolean),
            useReasoningModel: contract.intent === "CAREER_GUIDANCE",
            emotionalTone: "NEUTRAL" // Can be expanded in UCC later
        };
    }
}

module.exports = AgenticPlanner;
