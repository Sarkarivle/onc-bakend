/**
 * AgentLoop Module (Architectural Version 3.0.2 - Worker Node)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
 * Fix: Robust tool-call history unrolling with context stitching for Groq compatibility.
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
        if (entry.user) {
            normalizedMessages.push({ role: 'user', content: entry.user });
        }
        if (entry.assistant) {
            if (typeof entry.assistant === 'object' && entry.assistant !== null) {
                normalizedMessages.push(...AgentLoop._normalizeHistoryEntry({
                    role: 'assistant',
                    ...entry.assistant
                }));
            } else {
                normalizedMessages.push({ role: 'assistant', content: entry.assistant });
            }
        }
        if (entry.tool) {
            if (typeof entry.tool === 'object' && entry.tool !== null) {
                normalizedMessages.push(...AgentLoop._normalizeHistoryEntry({
                    role: 'tool',
                    ...entry.tool
                }));
            } else {
                normalizedMessages.push({ role: 'tool', content: entry.tool });
            }
        }

        return normalizedMessages;
    }

    static _hasToolCalls(message) {
        return Boolean(
            message &&
            message.role === 'assistant' &&
            Array.isArray(message.tool_calls) &&
            message.tool_calls.length > 0
        );
    }

    static _createContextClearedToolMessage(toolCall) {
        const functionName = toolCall && toolCall.function ? toolCall.function.name : 'unknown_tool';

        return {
            role: 'tool',
            tool_call_id: toolCall && toolCall.id ? toolCall.id : `call_context_cleared_${Date.now()}`,
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
            if (!message || !message.role) {
                i++;
                continue;
            }

            if (message.role === 'tool' && !message.tool_call_id) {
                i++;
                continue;
            }

            stitchedMessages.push(message);

            if (!AgentLoop._hasToolCalls(message)) {
                i++;
                continue;
            }

            const pendingToolCalls = new Map(
                message.tool_calls
                    .filter(toolCall => toolCall && toolCall.id)
                    .map(toolCall => [toolCall.id, toolCall])
            );

            i++;

            while (
                i < flatHistory.length &&
                flatHistory[i] &&
                flatHistory[i].role === 'tool' &&
                pendingToolCalls.has(flatHistory[i].tool_call_id)
            ) {
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

    /**
     * Executes the agentic loop.
     */
    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intent = "GENERAL") {
        console.log("🚀 AgentLoop: Starting loop for query:", userMessage);

        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        // 1. FETCH LONG-TERM MEMORIES
        let memories = [];
        try {
            memories = await MemoryEngine.searchMemory(userId, userMessage);
        } catch (e) {
            console.warn("⚠️ Memory retrieval failed:", e.message);
        }

        const memoryContext = memories.length > 0
            ? `\n# RELEVANT MEMORIES:\n${memories.map(m => `- [${m.category}] ${m.fact}`).join('\n')}`
            : "";

        const systemPrompt = `${dynamicSystemPrompt}${memoryContext}

# CRITICAL: TOOL_MODE INSTRUCTIONS
If you decide to use a tool (like search_jobs, calculate_math, etc.):
1. ZERO-PREAMBLE RULE: Output ONLY the tool call. Do NOT include any conversational text, greetings, or explanations (e.g., NO "Bhai, let me check", NO "I am searching").
2. ANTI-HALLUCINATION GUARD: NEVER use tags like <function>, </function>, [TOOL], or <thought>. Use the standard JSON tool call format provided by the system.
3. DATA MAPPING RULE: Map Indian education terms correctly:
   - "12th pass", "Barhwi", "Inter" -> max_education: "12th"
   - "10th pass", "Daswi", "High School" -> max_education: "10th"
   - "Graduate", "BA", "BSc", "BCom" -> max_education: "Graduate"
4. GENDER MAPPING: Use "Male" or "Female" strictly based on context. Default to "Male" if unknown.

# PERSONA & RESPONSE STRUCTURE (Use ONLY if NOT calling a tool):
1. You are "Jobo", the Bada Bhai AI. Tone: Friendly, elder-brotherly, empathetic. Use "${userId}" frequently.
2. Structure:
   - Start with a 1-sentence personalized opening.
   - Add a blank line (\\n\\n).
   - Provide the requested information using Markdown (headings, lists).`;

        // 2. SANITIZED MESSAGE UNROLLING + CONTEXT STITCHING
        let messages = [
            { role: 'system', content: systemPrompt }
        ];

        messages.push(...AgentLoop._unrollHistoryWithContextStitching(history));

        // CRITICAL FIX: Ensure no duplicate consecutive user messages
        // Check if the last message is already a user message matching the current input
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage) {
            console.log("⚠️ AgentLoop: Duplicate user message detected. Skipping redundant push.");
        } else {
            messages.push({ role: 'user', content: userMessage });
        }

        let iterations = 0;
        const maxIterations = 5;
        let capturedData = { jobs: "", documents: [] };

        try {
            while (iterations < maxIterations) {
                iterations++;

                const baseUrl = await LLMProvider.getBaseUrl();
                const headers = LLMProvider.getHeaders();
                const model = LLMProvider.getModel('personality');

                const payload = {
                    model: model,
                    messages: LLMProvider.sanitizeMessages(messages),
                    tools: selectedTools.length > 0 ? selectedTools : undefined,
                    tool_choice: selectedTools.length > 0 ? "auto" : undefined,
                    temperature: 0.3
                };

                // DEBUG: Log payload to identify 400 Bad Request causes
                console.log("📤 AgentLoop: Sending payload to Groq:", JSON.stringify(payload, null, 2));

                let response;
                try {
                    response = await axios.post(baseUrl, payload, { headers, timeout: 60000 });
                } catch (apiError) {
                    if (apiError.response) {
                        console.error("🛑 Groq API 400 Detail:", JSON.stringify(apiError.response.data, null, 2));
                    }
                    throw apiError;
                }

                // SAFETY CHECK: Verify response structure
                if (!response.data || !response.data.choices || !response.data.choices[0]) {
                    console.error("❌ Invalid API Response structure:", response.data);
                    throw new Error("API returned invalid response structure.");
                }

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage) {
                    console.error("❌ Assistant message missing in response.");
                    throw new Error("Assistant message is undefined.");
                }

                // Hallucination Fixer
                if (assistantMessage.content && assistantMessage.content.includes('<function=')) {
                    const regex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                    let match;
                    assistantMessage.tool_calls = assistantMessage.tool_calls || [];
                    while ((match = regex.exec(assistantMessage.content)) !== null) {
                        assistantMessage.tool_calls.push({
                            id: `call_${Date.now()}`,
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
                        } catch (e) {
                            toolResult = { error: "Execution failed" };
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            content: JSON.stringify(toolResult)
                        });
                    }
                } else {
                    return { content: assistantMessage.content, intent, capturedData, messages };
                }
            }
            return { content: "Bhai, kaafi koshish ki par sahi jawab nahi nikal paya.", intent, capturedData };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;