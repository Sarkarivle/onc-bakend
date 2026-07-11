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
        const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        console.log(`🚀 AgentLoop: Starting loop [${today}] for query:`, userMessage);

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

# PHASE 5: SOVEREIGN STRATEGIST PROTOCOLS
- **Today's Date:** ${today} (Point 23: Use for all timelines).
- **Recursive Reasoning (Point 21):** If "search_jobs" or "web_search" returns no relevant links, try 2 more times with different keywords (e.g., broad vs specific).
- **Scam Mitigation (Point 36):** If tool results contain "Registration Fee for Job", "Telegram link for payment", or "Unofficial hiring", immediately flag it as a **SCAM ALERT**.
- **Adversarial Check (Point 24):** Before concluding, ask yourself: "Is this the best advice for a ${profile.qualification || 'fresh'} student in ${profile.state || 'India'}?"

# CRITICAL: TOOL_MODE INSTRUCTIONS
If you decide to use a tool:
1. ZERO-PREAMBLE RULE: Output ONLY the tool call. No chatter.
2. DATA MAPPING: Map Indian terms (12th, Graduate, etc.) correctly.
3. persistence: If "search_jobs" fails, use "web_search" to find live updates.

# RESPONSE STRUCTURE (If no tool is needed):
- Use the 'Jobo' Persona: Wise, Authoritative, Brotherly.
- Address user as "${userId}".
- Structure: Summary -> Detailed Insight (Markdown) -> Actionable 7-Day Blueprint.`;

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
            // ROADMAP: Multi-modal Support (Groq/OpenAI Vision)
            if (context.image_url) {
                console.log("📸 AgentLoop: Injecting Multi-modal Vision Payload");
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: userMessage || "Analyze this image." },
                        {
                            type: "image_url",
                            image_url: {
                                url: context.image_url // This must be the raw "data:image/jpeg;base64,..." string
                            }
                        }
                    ]
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

                // --- Hallucination Fixer & Raw JSON Parser ---
                if (assistantMessage.content) {
                    // A. Legacy Tag Fixer (<function=name>{args}</function>)
                    if (assistantMessage.content.includes('<function=')) {
                        const regex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                        let match;
                        assistantMessage.tool_calls = assistantMessage.tool_calls || [];
                        while ((match = regex.exec(assistantMessage.content)) !== null) {
                            assistantMessage.tool_calls.push({
                                id: `call_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                type: 'function',
                                function: { name: match[1], arguments: match[2] }
                            });
                            assistantMessage.content = assistantMessage.content.replace(match[0], '').trim();
                        }
                    }

                    // B. Raw JSON Leak Fixer (Handles cases where LLM prints JSON in content)
                    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
                        const jsonMatch = assistantMessage.content.match(/(\{[\s\S]*\})/);
                        if (jsonMatch) {
                            try {
                                const rawJson = jsonMatch[0];
                                const parsed = JSON.parse(rawJson);

                                // Detection logic for tool name and args
                                let toolName = parsed.name || parsed.function || parsed.tool;
                                let toolArgs = parsed.arguments || parsed.parameters || parsed.args;

                                // Fallback Heuristics: If it's a naked object with tool-specific keys
                                if (!toolName) {
                                    if (parsed.job_keyword) toolName = 'search_jobs';
                                    else if (parsed.expression) toolName = 'calculate_math';
                                    else if (parsed.query) toolName = 'web_search';
                                    else if (parsed.qualification || parsed.skills) toolName = 'update_user_profile';
                                    else if (parsed.image_url || parsed.imageUrl) toolName = 'analyze_image';
                                }

                                if (toolName) {
                                    // Ensure search_jobs has user_filters if it's missing (mapping flat to nested)
                                    if (toolName === 'search_jobs' && !parsed.user_filters) {
                                        toolArgs = {
                                            job_keyword: parsed.job_keyword,
                                            user_filters: {
                                                gender: parsed.gender || profile.gender || "Male",
                                                max_education: parsed.max_education || parsed.qualification || profile.qualification || "12th",
                                                location_pref: parsed.location || parsed.location_pref || profile.location
                                            }
                                        };
                                    } else if (toolName === 'analyze_image') {
                                        toolArgs = {
                                            image_url: parsed.image_url || parsed.imageUrl,
                                            prompt: parsed.prompt || parsed.instruction || userMessage
                                        };
                                    } else if (!toolArgs) {
                                        toolArgs = parsed;
                                    }

                                    assistantMessage.tool_calls = [{
                                        id: `call_leak_${Date.now()}`,
                                        type: 'function',
                                        function: {
                                            name: toolName,
                                            arguments: typeof toolArgs === 'string' ? toolArgs : JSON.stringify(toolArgs)
                                        }
                                    }];

                                    // Strip the JSON from content to avoid rendering it in the UI
                                    assistantMessage.content = assistantMessage.content.replace(rawJson, '').trim();
                                }
                            } catch (e) {
                                // Not a valid JSON or parsing failed - ignore
                            }
                        }
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
            return { content: "Sorry, main abhi is information ko process nahi kar pa raha hoon. Please apne sawal ko thoda aur clear karein.", intent, capturedData };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;