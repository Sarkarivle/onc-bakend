/**
 * AgentLoop Module (Architectural Version 4.2 - Sovereign Worker)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
 * Optimized for Groq's Llama-3 Native Tooling.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    static _normalizeHistoryEntry(entry) {
        if (!entry || typeof entry !== 'object') return [];
        if (entry.role) {
            const normalized = { role: entry.role };
            if (Object.prototype.hasOwnProperty.call(entry, 'content')) normalized.content = entry.content;
            else if (entry.role === 'assistant' && entry.tool_calls) normalized.content = "";
            if (entry.tool_calls) normalized.tool_calls = entry.tool_calls;
            if (entry.tool_call_id) normalized.tool_call_id = entry.tool_call_id;
            if (entry.name) normalized.name = entry.name;
            return [normalized];
        }
        const normalizedMessages = [];
        if (entry.user) normalizedMessages.push({ role: 'user', content: entry.user });
        if (entry.assistant) {
            if (typeof entry.assistant === 'object' && entry.assistant !== null) {
                normalizedMessages.push(...AgentLoop._normalizeHistoryEntry({ role: 'assistant', ...entry.assistant }));
            } else {
                normalizedMessages.push({ role: 'assistant', content: entry.assistant });
            }
        }
        if (entry.tool) {
            if (typeof entry.tool === 'object' && entry.tool !== null) {
                normalizedMessages.push(...AgentLoop._normalizeHistoryEntry({ role: 'tool', ...entry.tool }));
            } else {
                normalizedMessages.push({ role: 'tool', content: entry.tool });
            }
        }
        return normalizedMessages;
    }

    static _hasToolCalls(message) {
        return Boolean(message && message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0);
    }

    static _createContextClearedToolMessage(toolCall) {
        const functionName = toolCall && toolCall.function ? toolCall.function.name : 'unknown_tool';
        return {
            role: 'tool',
            tool_call_id: toolCall && toolCall.id ? toolCall.id : "call_cl_" + Date.now(),
            name: functionName,
            content: JSON.stringify({ status: "CONTEXT_CLEARED" })
        };
    }

    static _unrollHistoryWithContextStitching(history) {
        const flatHistory = [];
        for (const entry of history || []) flatHistory.push(...AgentLoop._normalizeHistoryEntry(entry));
        const stitchedMessages = [];
        let i = 0;
        while (i < flatHistory.length) {
            const message = flatHistory[i];
            if (!message || !message.role) { i++; continue; }
            if (message.role === 'tool' && !message.tool_call_id) { i++; continue; }
            stitchedMessages.push(message);
            if (!AgentLoop._hasToolCalls(message)) { i++; continue; }
            const pendingToolCalls = new Map(message.tool_calls.filter(t => t && t.id).map(t => [t.id, t]));
            i++;
            while (i < flatHistory.length && flatHistory[i] && flatHistory[i].role === 'tool' && pendingToolCalls.has(flatHistory[i].tool_call_id)) {
                pendingToolCalls.delete(flatHistory[i].tool_call_id);
                stitchedMessages.push(flatHistory[i]);
                i++;
            }
            for (const toolCall of pendingToolCalls.values()) stitchedMessages.push(AgentLoop._createContextClearedToolMessage(toolCall));
        }
        return stitchedMessages;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intent = "GENERAL") {
        const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        let memories = [];
        try { memories = await MemoryEngine.searchMemory(userId, userMessage); } catch (e) {}
        const memoryContext = memories.length > 0 ? "\n# RELEVANT MEMORIES:\n" + memories.map(m => `- [${m.category}] ${m.fact}`).join('\n') : "";

        // CORE SOVEREIGN SYSTEM PROMPT (Optimized for Tool Integrity)
        const systemPrompt = dynamicSystemPrompt + memoryContext + "\n\n# OPERATIONAL CONTEXT:\n- **Today's Date:** " + today + "\n- **Current User Profile:** " + (profile.qualification || 'Graduate') + " from " + (profile.location || 'India') + ".\n\n# CRITICAL TOOL PROTOCOL:\n1. If a tool is needed for data, call it NATIVELY.\n2. **NO MIXED CONTENT:** If calling a tool, do NOT output ANY conversational text or preamble. Output ONLY the tool call.\n3. **ZERO TAGS:** Do not use <function> or any XML tags. Use the provided tool calling interface only.\n4. **DATA MAPPING:** Map terms like 'Graduation' to 'Graduate' and 'Shahjahanpur' to 'Uttar Pradesh' correctly in tool arguments.";

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...AgentLoop._unrollHistoryWithContextStitching(history));

        if (!(messages[messages.length - 1]?.role === 'user' && messages[messages.length - 1]?.content === userMessage)) {
            if (context.image_url) {
                messages.push({ role: "user", content: [{ type: "text", text: userMessage || "Analyze this image." }, { type: "image_url", image_url: { url: context.image_url } }] });
            } else {
                messages.push({ role: 'user', content: userMessage });
            }
        }

        let iterations = 0;
        const maxIterations = 5;
        let capturedData = { jobs: "", documents: [] };

        try {
            while (iterations < maxIterations) {
                iterations++;
                const baseUrl = await LLMProvider.getBaseUrl();
                const headers = LLMProvider.getHeaders();
                const sanitizedMessages = LLMProvider.sanitizeMessages(messages);
                const model = LLMProvider.getModel('personality', sanitizedMessages);

                const payload = {
                    model,
                    messages: sanitizedMessages,
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    tool_choice: selectedTools.length > 0 ? "auto" : undefined,
                    temperature: 0.1 // Lowered for tool stability
                };

                let response;
                try {
                    response = await axios.post(baseUrl, payload, { headers, timeout: 60000 });
                } catch (apiError) {
                    if (apiError.response) console.error("🛑 Groq API Error:", JSON.stringify(apiError.response.data, null, 2));
                    throw apiError;
                }

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage) throw new Error("Assistant message missing.");

                if (!assistantMessage.content) assistantMessage.content = "";
                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        let toolResult;
                        try {
                            const args = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
                            toolResult = implementation ? await implementation(args, profile) : { error: "Not implemented" };
                            if (toolCall.function.name === 'search_jobs' && toolResult.jobs) {
                                capturedData.jobs = toolResult.jobs;
                                capturedData.documents = toolResult.documents || [];
                            }
                        } catch (e) { toolResult = { error: "Execution failed" }; }
                        messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: JSON.stringify(toolResult) });
                    }
                } else {
                    return { content: assistantMessage.content, intent, capturedData, messages };
                }
            }
            return { content: "Main abhi thoda confuse hoon, par koshish kar raha hoon. Dubara puchein.", intent, capturedData };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
