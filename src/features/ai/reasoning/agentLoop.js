/**
 * AgentLoop Module (Architectural Version 3.0 - Worker Node)
 * Responsibility: Executing the Tool-Calling Loop with dynamic prompts and tools.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    /**
     * Executes the agentic loop.
     * @param {string} userMessage - Current query.
     * @param {Array} history - Chat history.
     * @param {Object} context - Extra context (profile, userId).
     * @param {string} dynamicSystemPrompt - Prompt injected by Supervisor.
     * @param {Array} selectedTools - Tool subset injected by Supervisor.
     * @param {string} intent - Intent detected by Supervisor.
     */
    static async run(userMessage, history = [], context = {}, dynamicSystemPrompt, selectedTools = [], intent = "GENERAL") {
        console.log("🚀 AgentLoop: Starting loop for query:", userMessage);

        const profile = context.profile || {};
        const userId = context.userId || profile.name || "Bhai";

        // 1. FETCH LONG-TERM MEMORIES
        let memories = [];
        try {
            memories = await MemoryEngine.searchMemory(userId, userMessage);
            console.log(`🧠 AgentLoop: Retrieved ${memories.length} relevant memories.`);
        } catch (e) {
            console.warn("⚠️ Memory retrieval failed:", e.message);
        }

        const memoryContext = memories.length > 0
            ? `\n# RELEVANT MEMORIES:\n${memories.map(m => `- [${m.category}] ${m.fact}`).join('\n')}`
            : "";

        // Combine Supervisor prompt with Memory
        const systemPrompt = `${dynamicSystemPrompt}${memoryContext}\n\n# CRITICAL: If calling tools, output ONLY the tool call. NO conversational text during TOOL_MODE.`;

        let messages = [
            { role: 'system', content: systemPrompt },
            ...history.flatMap(h => [
                { role: 'user', content: h.user || h.content },
                { role: 'assistant', content: h.assistant || h.content }
            ]).filter(m => m.content),
            { role: 'user', content: userMessage }
        ];

        let iterations = 0;
        const maxIterations = 5;
        let finalIntent = intent;
        let capturedData = { jobs: "", documents: [] };

        try {
            while (iterations < maxIterations) {
                iterations++;
                console.log(`🧠 AgentLoop: Iteration ${iterations}`);

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

                const response = await axios.post(baseUrl, payload, {
                    headers,
                    timeout: 60000
                });

                const assistantMessage = response.data.choices[0].message;
                const usage = response.data.usage || {};

                // --- HALLUCINATION FIXER ---
                if (assistantMessage.content && assistantMessage.content.includes('<function=')) {
                    const regex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                    let match;
                    assistantMessage.tool_calls = assistantMessage.tool_calls || [];
                    while ((match = regex.exec(assistantMessage.content)) !== null) {
                        const [fullMatch, name, argsStr] = match;
                        assistantMessage.tool_calls.push({
                            id: `call_hallucinated_${Date.now()}`,
                            type: 'function',
                            function: { name, arguments: argsStr }
                        });
                        assistantMessage.content = assistantMessage.content.replace(fullMatch, '').trim();
                    }
                }

                if (!assistantMessage.content) assistantMessage.content = "";
                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    console.log(`🛠️ LLM requested ${assistantMessage.tool_calls.length} tool calls`);

                    for (const toolCall of assistantMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        let functionArgs = {};
                        try {
                            functionArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error("❌ Failed to parse tool arguments:", toolCall.function.arguments);
                        }

                        const implementation = toolImplementations[functionName];
                        let toolResult;

                        if (implementation) {
                            toolResult = await implementation(functionArgs, profile);
                            if (functionName === 'search_jobs' && toolResult.jobs) {
                                capturedData.jobs = toolResult.jobs;
                                capturedData.documents = toolResult.documents || [];
                            }
                        } else {
                            toolResult = { error: `Tool ${functionName} is not implemented.` };
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: JSON.stringify(toolResult)
                        });
                    }
                } else {
                    console.log("🏁 Final response received.");
                    return {
                        content: assistantMessage.content,
                        intent: finalIntent,
                        capturedData,
                        messages
                    };
                }
            }

            return {
                content: "Bhai, kaafi koshish ki par sahi jawab nahi nikal paya. Ek baar phir se try karein?",
                intent: finalIntent,
                capturedData
            };
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
