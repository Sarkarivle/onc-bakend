/**
 * AgentLoop Module (Architectural Version 4.0 - Sovereign Worker)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
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
            if (Object.prototype.hasOwnProperty.call(entry, 'content')) {
                normalized.content = entry.content;
            } else if (entry.role === 'assistant' && entry.tool_calls) {
                normalized.content = "";
            }
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
            tool_call_id: toolCall && toolCall.id ? toolCall.id : "call_context_cleared_" + Date.now(),
            name: functionName,
            content: JSON.stringify({
                status: "CONTEXT_CLEARED",
                message: "Previous tool output was not available in the restored conversation context."
            })
        };
    }

    static _unrollHistoryWithContextStitching(history) {
        const flatHistory = [];
        for (const entry of history || []) {
            flatHistory.push(...AgentLoop._normalizeHistoryEntry(entry));
        }

        const stitchedMessages = [];
        let i = 0;
        while (i < flatHistory.length) {
            const message = flatHistory[i];
            if (!message || !message.role) { i++; continue; }
            if (message.role === 'tool' && !message.tool_call_id) { i++; continue; }

            stitchedMessages.push(message);
            if (!AgentLoop._hasToolCalls(message)) { i++; continue; }

            const pendingToolCalls = new Map(
                message.tool_calls.filter(toolCall => toolCall && toolCall.id).map(toolCall => [toolCall.id, toolCall])
            );
            i++;
            while (i < flatHistory.length && flatHistory[i] && flatHistory[i].role === 'tool' && pendingToolCalls.has(flatHistory[i].tool_call_id)) {
                pendingToolCalls.delete(flatHistory[i].tool_call_id);
                stitchedMessages.push(flatHistory[i]);
                i++;
            }
            for (const toolCall of pendingToolCalls.values()) {
                stitchedMessages.push(AgentLoop._createContextClearedToolMessage(toolCall));
            }
        }
        return stitchedMessages;
    }

    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intent = "GENERAL") {
        const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        console.log("🚀 AgentLoop: Starting loop [" + today + "] for query:", userMessage);

        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        let memories = [];
        try { memories = await MemoryEngine.searchMemory(userId, userMessage); } catch (e) {}

        const memoryContext = memories.length > 0
            ? "\n# RELEVANT MEMORIES:\n" + memories.map(m => "- [" + m.category + "] " + m.fact).join('\n')
            : "";

        const systemPrompt = dynamicSystemPrompt + memoryContext + "\n\n# OPERATIONAL CONTEXT:\n- **Today's Date:** " + today + "\n- **User:** " + userId + " (" + (profile.qualification || 'Student') + " from " + (profile.location || 'India') + ").\n\n# TOOL PROTOCOL:\n- If you need real-time data, use the native tool calling interface.\n- **ZERO PREAMBLE:** If calling a tool, do not output any conversational text. Output ONLY the tool call.";

        let messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...AgentLoop._unrollHistoryWithContextStitching(history));

        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage) {
            console.log("⚠️ AgentLoop: Duplicate user message detected. Skipping redundant push.");
        } else {
            if (context.image_url) {
                messages.push({
                    role: "user",
                    content: [{ type: "text", text: userMessage || "Analyze this image." }, { type: "image_url", image_url: { url: context.image_url } }]
                });
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
                    model: model,
                    messages: sanitizedMessages,
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    tool_choice: selectedTools.length > 0 ? "auto" : undefined,
                    temperature: 0.3
                };

                console.log("📤 AgentLoop: Sending payload to Groq:", JSON.stringify(payload, null, 2));

                let response;
                try {
                    response = await axios.post(baseUrl, payload, { headers, timeout: 60000 });
                } catch (apiError) {
                    if (apiError.response) console.error("🛑 Groq API 400 Detail:", JSON.stringify(apiError.response.data, null, 2));
                    throw apiError;
                }

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage) throw new Error("Assistant message is undefined.");

                // Hallucination Fixer
                if (assistantMessage.content && assistantMessage.content.includes('<function=')) {
                    const regex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                    let match;
                    assistantMessage.tool_calls = assistantMessage.tool_calls || [];
                    while ((match = regex.exec(assistantMessage.content)) !== null) {
                        assistantMessage.tool_calls.push({
                            id: "call_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                            type: 'function',
                            function: { name: match[1], arguments: match[2] }
                        });
                        assistantMessage.content = assistantMessage.content.replace(match[0], '').trim();
                    }
                }

                if (!assistantMessage.content) assistantMessage.content = "";
                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    for (const toolCall of assistantMessage.tool_calls) {
                        const implementation = toolImplementations[toolCall.function.name];
                        let toolResult;
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
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
            return { content: "Sorry, main abhi is information ko process nahi kar pa raha hoon.", intent, capturedData };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
