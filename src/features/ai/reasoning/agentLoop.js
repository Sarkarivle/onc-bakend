/**
 * AgentLoop Module (Architectural Version 3.0.1 - Worker Node)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
 * Fix: Added duplicate user message prevention to satisfy API role-ordering requirements.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
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

        const systemPrompt = `${dynamicSystemPrompt}${memoryContext}\n\n# CRITICAL: If calling tools, output ONLY the tool call. NO conversational text during TOOL_MODE.`;

        // 2. SANITIZED MESSAGE UNROLLING
        let messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Process history and add to messages
        for (const h of history) {
            if (h.role && h.content) {
                messages.push(h);
            } else if (h.user || h.assistant) {
                if (h.user) messages.push({ role: 'user', content: h.user });
                if (h.assistant) {
                    if (typeof h.assistant === 'object' && h.assistant !== null) {
                        messages.push(h.assistant);
                    } else {
                        messages.push({ role: 'assistant', content: h.assistant });
                    }
                }
            }
        }

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

                const response = await axios.post(baseUrl, payload, { headers, timeout: 60000 });
                const assistantMessage = response.data.choices[0].message;

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