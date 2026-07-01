/**
 * AgenticPlanner Module (Architectural Version 3.0)
 * Responsibility: Executing Technical Strategy based on IntentEngine's Decision.
 * NO Intent Mapping should happen here.
 */
const LLMProvider = require('../generation/llmProvider');

class AgenticPlanner {
    /**
     * Consumes the Intent Contract and decides Tool selection.
     */
    static async generatePlan(query, contract, context = {}) {
        // 1. Technical Resource Assignment (Tools)
        const tools = [];
        const priorityModules = ["CORE", "PERSONALITY"];

        // Determine if DB is needed based on the centralized mode
        const needsDatabase = ["JOB_SEARCH", "JOB_DETAILS", "SCHOLARSHIP"].includes(contract.mode);
        if (needsDatabase) tools.push("DATABASE");

        // Determine if Profile context is needed
        if (contract.mode === "PROFILE_CHECK" || contract.mode === "CAREER_GUIDANCE") {
            tools.push("USER_PROFILE");
        }

        // Determine if Math Tool is needed
        const mathKeywords = ['+', '-', '*', '/', 'multiply', 'divide', 'calculate', 'hisab', 'hisab-kitab'];
        if (mathKeywords.some(k => query.toLowerCase().includes(k)) || contract.normalizedIntent === 'MATH') {
            tools.push("CALCULATOR");
        }

        // Module Selection based on Intent
        if (contract.normalizedIntent === "JOB_SEARCH" || contract.normalizedIntent === "DISCOVERY") {
            priorityModules.push("GOVT_JOB");
        } else if (contract.normalizedIntent === "CAREER_GUIDANCE") {
            priorityModules.push("CAREER");
        } else if (contract.normalizedIntent === "RESUME") {
            priorityModules.push("RESUME");
        }

        // 2. Final Strategy Packaging
        return {
            mode: contract.mode,
            behavior: contract.behavior,
            intent: contract.normalizedIntent,
            tools: tools,
            needsDatabase: needsDatabase,
            priorityModules: priorityModules,
            useReasoningModel: contract.mode === "CAREER_GUIDANCE",
            emotionalTone: contract.emotionalTone || "NEUTRAL"
        };
    }

    /**
     * Strategic Pivot if no data found.
     */
    static async generatePivotPlan(query, previousError) {
        // ... existing logic ...
        return { tool: "WEB_SEARCH", newSearchQuery: query };
    }
}

module.exports = AgenticPlanner;
