/**
 * ToolRegistry Module (Architectural Version 7.0)
 * Responsibility: Registering tools with Dual-Memory support.
 */
const MemoryEngine = require('../memory/memoryEngine');
const EligibilityEngine = require('../../eligibility/EligibilityEngine');
const AgeCalculator = require('../../eligibility/utils/AgeCalculator');

class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(name, toolInstance) {
        this.tools.set(name.toUpperCase(), toolInstance);
    }

    async execute(name, input, context) {
        const tool = this.tools.get(name.toUpperCase());
        if (!tool) throw new Error(`Tool ${name} not found.`);

        try {
            await tool.validate(input);

            // Timeout enforcement with Promise.race
            const timeoutMs = tool.timeout || 10000;

            return await Promise.race([
                tool.execute(input, context),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout: Tool ${name} exceeded ${timeoutMs}ms`)), timeoutMs)
                )
            ]);
        } catch (error) {
            console.error(`❌ Tool Execution Error [${name}]:`, error.message);
            if (tool.safeFallback) {
                console.log(`ℹ️ Using safe fallback for [${name}]`);
                return tool.safeFallback();
            }
            throw error;
        }
    }

    getTool(name) {
        return this.tools.get(name.toUpperCase());
    }
}

const registry = new ToolRegistry();

// --- Tool Implementations ---

// 1. RAG Tool
const RetrievalEngine = require('../knowledge/retrievalEngine');
registry.register('RAG', {
    timeout: 8000,
    validate: (input) => { if (!input) throw new Error("RAG requires input"); },
    execute: async (input, context) => {
        const result = await RetrievalEngine.searchJobs(input, context.profile, context.plan);
        return { jobs: result?.jobs || "" };
    },
    safeFallback: () => ({ jobs: "", documents: [], confidence: 0 })
});

// 2. MEMORY Tool (RE-IMPLEMENTED FOR DUAL-MEMORY)
registry.register('MEMORY', {
    timeout: 3000,
    validate: () => {},
    execute: async (input, context) => {
        const userId = context.profile?.name || "Anonymous";
        const [longTerm, shortTerm] = await Promise.all([
            MemoryEngine.searchMemory(userId, input || context.userMessage),
            MemoryEngine.getShortTermContext(context.sessionId)
        ]);

        return {
            facts: longTerm.map(m => m.fact),
            recentHistory: shortTerm
        };
    },
    safeFallback: () => ({ facts: [], recentHistory: [] })
});

// 3. PROFILE Tool
registry.register('PROFILE', {
    timeout: 2000,
    validate: () => {},
    execute: async (_, context) => context.profile,
    safeFallback: () => ({})
});

// 4. CALCULATOR Tool
const Calculator = require('../tools/calculator');
registry.register('CALCULATOR', {
    timeout: 1000,
    validate: (input) => { if (!input) throw new Error("Calculator requires input"); },
    execute: async (input) => Calculator.execute(input),
    safeFallback: () => ({ result: "" })
});

// 5. AGE CALCULATOR Tool
registry.register('AGE_CALCULATOR', {
    timeout: 1000,
    validate: () => {},
    execute: async (input, context) => {
        const dob = context.profile?.dob || input;
        if (!dob) return { success: false, result: "DOB not available" };

        const result = AgeCalculator.calculate(dob, new Date());
        return result;
    },
    safeFallback: () => ({ success: false, result: "DOB not available" })
});

// 6. ELIGIBILITY CHECKER Tool
registry.register('ELIGIBILITY_CHECKER', {
    timeout: 3000,
    validate: () => {},
    execute: async (input, context) => {
        const profile = context.profile || {};
        const jobData = context.plan?.jobData || context.execResult?.outputs?.rag?.documents?.[0];

        if (!jobData) {
            return { success: false, message: "Job data missing for eligibility check." };
        }

        const result = await EligibilityEngine.evaluate(profile, jobData);
        return {
            success: true,
            eligible: result.status === 'ELIGIBLE',
            report: result,
            ai_tip: result.ai_tip
        };
    },
    safeFallback: () => ({ success: false, eligible: null, reasons: ["Eligibility service unavailable"] })
});

// 7. LLM Tool retained for registry completeness; ExecutionEngine keeps final LLM after PromptBuilder.
const LLMProvider = require('../generation/core_engine/llmProvider');
registry.register('LLM', {
    timeout: 35000,
    validate: (input) => {
        if (!input) throw new Error("LLM requires input");
    },
    execute: async (input, context) => {
        // If input is a string, wrap it in a message format
        const messages = (typeof input === 'string')
            ? [{ role: 'user', content: input }]
            : (input.messages || []);

        if (messages.length === 0) throw new Error("LLM requires messages");
        return LLMProvider.chat(messages);
    }
});

// 8. DATE_CALCULATOR Tool
const DateTool = require('../tools/dateTool');
registry.register('DATE_CALCULATOR', {
    timeout: 1000,
    validate: (input) => { if (!input) throw new Error("DATE_CALCULATOR requires input"); },
    execute: async (input) => {
        const dateStr = typeof input === 'string' ? input : input.date;
        return DateTool.calculateUrgency(dateStr);
    },
    safeFallback: () => ({ text: "Date jankari upalabd nahi hai", daysRemaining: null, status: "unknown" })
});

module.exports = registry;
