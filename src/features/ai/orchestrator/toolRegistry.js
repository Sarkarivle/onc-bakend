/**
 * ToolRegistry Module (Architectural Version 7.0)
 * Responsibility: Registering tools with Dual-Memory support.
 */
const MemoryEngine = require('../memory/memoryEngine');

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
            return await tool.execute(input, context);
        } catch (error) {
            console.error(`❌ Tool Execution Error [${name}]:`, error.message);
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
    }
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
    }
});

// 3. PROFILE Tool
registry.register('PROFILE', {
    timeout: 2000,
    validate: () => {},
    execute: async (_, context) => context.profile
});

// 4. CALCULATOR Tool
const Calculator = require('../tools/calculator');
registry.register('CALCULATOR', {
    timeout: 1000,
    validate: (input) => { if (!input) throw new Error("Calculator requires input"); },
    execute: async (input) => Calculator.execute(input)
});

// 5. LLM Tool
const LLMProvider = require('../generation/llmProvider');
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

module.exports = registry;
