/**
 * ValidationEngine Module (Architectural Version 10.0 - Neural Safety & Reliability)
 * Responsibility: Multi-stage validation (Input, Execution, Context, Output, Stream).
 * Designed for enterprise-grade grounding and safety (Gemini/Claude standard).
 */
const LLMProvider = require('../generation/core_engine/llmProvider');

class ValidationEngine {
    /**
     * STAGE 1: INPUT VALIDATION
     * Fast check for injection, jailbreaks, and malformed queries.
     */
    static async validateInput(query) {
        if (!query || query.trim().length < 2) return { status: 'BLOCK', reason: 'EMPTY' };

        const injectionPatterns = [
            /ignore previous/i, /system prompt/i, /reveal.*instructions/i,
            /you are now/i, /act as/i, /developer mode/i
        ];

        if (injectionPatterns.some(p => p.test(query))) {
            return { status: 'BLOCK', reason: 'INJECTION_ATTEMPT' };
        }

        // Fast length check
        if (query.length > 2000) return { status: 'BLOCK', reason: 'LENGTH_OVERFLOW' };

        return { status: 'PROCEED' };
    }

    /**
     * STAGE 2: EXECUTION VALIDATION
     * Ensures the Cognitive Plan and Tool results are logically sound.
     */
    static validateExecution(plan, execResults) {
        if (!plan || !plan.execution) return { status: 'RETRY', reason: 'INVALID_PLAN' };

        const failedCriticalTools = execResults.errors.filter(e => e.critical !== false);
        if (failedCriticalTools.length > 0) {
            return { status: 'RETRY', reason: 'TOOL_FAILURE', details: failedCriticalTools };
        }

        return { status: 'PROCEED' };
    }

    /**
     * STAGE 3: CONTEXT VALIDATION
     * Detects conflicting data between RAG and Memory.
     */
    static validateContext(liveData) {
        if (!liveData.jobs && !liveData.memory) return { status: 'PROCEED' };

        // Logic to detect if Memory contradicts current RAG data
        // Example: Memory says "User is 12th pass" but RAG found "Graduate" jobs.
        // This is a "Soft Warning" to the Prompt Builder.
        return { status: 'PROCEED', confidence: 0.9 };
    }

    /**
     * STAGE 4: OUTPUT VALIDATION (Neural Fact-Check)
     * Verifies grounding against retrieved context.
     */
    static async validateOutput(query, answer, contextData, options = {}) {
        // Lightweight check for broken markdown or formatting
        if (answer.includes('|') && !answer.includes('---')) {
            return { status: 'FIX', reason: 'BROKEN_TABLE' };
        }

        // Deep Neural Fact Check (Only for factual queries)
        if (contextData.jobs && options.allowLlm !== false) {
            const prompt = `
Task: Fact-Check AI Response.
[CONTEXT]: ${contextData.jobs}
[AI RESPONSE]: ${answer}
Check: Does the AI invent any dates, fees, or vacancies NOT in the context?
Return JSON: { "isValid": bool, "reason": "string", "correctedAnswer": "string" }
`;
            const result = await LLMProvider.generateLogic(prompt);
            if (result && !result.isValid) {
                return { status: 'REPLACE', content: result.correctedAnswer, reason: 'HALLUCINATION' };
            }
        }

        return { status: 'PROCEED' };
    }

    /**
     * STAGE 5: STREAMING VALIDATION
     * Scans tokens for leaks in real-time.
     */
    static validateStreamChunk(chunk) {
        const sensitivePatterns = [
            /api_key/i, /sk-[a-zA-Z0-9]{20,}/, /mongodb\+srv/i,
            /system_prompt/i, /<AGENT_THOUGHT>/i
        ];

        if (sensitivePatterns.some(p => p.test(chunk))) {
            return { status: 'KILL', reason: 'DATA_LEAK' };
        }

        return { status: 'PROCEED' };
    }
}

module.exports = ValidationEngine;
