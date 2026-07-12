/**
 * AgentLoop Module (Architectural Version 4.3 - Strict Sovereign Worker)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
 * Fix: Forced Tool Isolation to prevent 400 Bad Request on Groq.
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

        // NATIVE TOOL PROTOCOL (GEMINI ADVANCED REASONING STANDARD)
        const toolProtocol = `
# CRITICAL: HYBRID REASONING PROTOCOL
1. **TOOL ISOLATION (TURN 1):** If you need data (Comparison, Jobs, Eligibility), your first response MUST contain ONLY the tool call. No preamble, no "Bhai tension mat le", no reasoning.
2. **MULTI-TASKING:** Address all parts of the user's query in your FINAL response (after tool results).
3. **DATA DENSITY:** Once you have the tool data, your FINAL response MUST be rich, detailed (3-4 sentences per paragraph), and follow the "Elite Mentor" structure.
4. **NO TAGS:** Use native tool interface only. Never use <function> tags.
5. **SUCCESS PATH:** Even if ineligible, show the future preparation path.
6. **PRO-TIP & NEXT STEP:** End with these directly, no headings.
`;

        const systemPrompt = toolProtocol + "\n" + dynamicSystemPrompt + memoryContext + "\n\n# OPERATIONAL CONTEXT:\n- Today: " + today + "\n- User: " + userId + " (" + (profile.qualification || 'Student') + ").";

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
        const maxIterations = 5; // Increased back to 5 to allow for research + final response
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
                    temperature: 0.1,
                    max_tokens: 1500
                };

                const startTime = Date.now();
                console.log("📤 AgentLoop Iteration " + iterations + ": Requesting...");

                let response;
                let assistantMessage;
                try {
                    response = await axios.post(baseUrl, payload, { headers, timeout: 60000 });
                    assistantMessage = response.data.choices[0].message;

                    // Log the AI Event
                    LLMProvider._logAIEvent('AGENT_LOOP_TURN_' + iterations, payload, assistantMessage, Date.now() - startTime, response.data.usage, baseUrl);
                } catch (apiError) {
                    const errorData = apiError.response?.data?.error;
                    if (errorData && errorData.failed_generation) {
                        console.warn("⚠️ Salvaging failed_generation from Groq 400...");
                        assistantMessage = {
                            role: 'assistant',
                            content: errorData.failed_generation
                        };
                    } else {
                        if (apiError.response) console.error("🛑 Groq API 400 Detail:", JSON.stringify(apiError.response.data, null, 2));
                        throw apiError;
                    }
                }

                if (!assistantMessage) throw new Error("Assistant message missing.");

                // SANITY FIX 1: If model hallucinations include tool-like strings in content
                if (assistantMessage.content && (assistantMessage.content.includes('<function=') || assistantMessage.content.includes('{"name":') || assistantMessage.content.includes('"function":'))) {
                    console.warn("⚠️ Hallucination or Hybrid Response detected! Extracting tool calls...");

                    assistantMessage.tool_calls = assistantMessage.tool_calls || [];

                    // 1. Extract XML-like <function=name>{"args"}</function>
                    const xmlRegex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                    let match;
                    while ((match = xmlRegex.exec(assistantMessage.content)) !== null) {
                        try {
                            assistantMessage.tool_calls.push({
                                id: "call_halluc_xml_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                                type: 'function',
                                function: { name: match[1], arguments: match[2].trim() }
                            });
                            assistantMessage.content = assistantMessage.content.replace(match[0], '').trim();
                        } catch (e) {}
                    }

                    // 2. Extract JSON blocks if the model just printed them (common in 400 salvaging)
                    // We look for objects that have "name" and either "parameters" or "arguments"
                    const jsonRegex = /\{[\s\S]*?"name"[\s\S]*?(?:"parameters"|"arguments")[\s\S]*?\}/g;
                    while ((match = jsonRegex.exec(assistantMessage.content)) !== null) {
                        try {
                            const parsed = JSON.parse(match[0]);
                            const toolName = parsed.name || parsed.function?.name;
                            const toolArgs = parsed.parameters || parsed.arguments || parsed.function?.arguments;

                            if (toolName && toolArgs) {
                                assistantMessage.tool_calls.push({
                                    id: "call_halluc_json_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                                    type: 'function',
                                    function: {
                                        name: toolName,
                                        arguments: typeof toolArgs === 'object' ? JSON.stringify(toolArgs) : toolArgs
                                    }
                                });
                                assistantMessage.content = assistantMessage.content.replace(match[0], '').trim();
                            }
                        } catch (e) {}
                    }
                }

                // Turn 1 Enforcement: If we have tool calls in iteration 1, we MUST NOT have content
                if (iterations === 1 && assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    console.log("🛡️ Enforcing Tool Isolation for Turn 1: Stripping conversational preamble.");
                    assistantMessage.content = "";
                }

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
            return { content: "Main abhi thoda dimaag laga raha hoon, par response nahi mil pa raha. Thodi der mein puchen.", intent, capturedData };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
