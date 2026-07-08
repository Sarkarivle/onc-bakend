/**
 * AgentLoop Module (Architectural Version 2.0 - Universal Mentor Architecture)
 * Responsibility: Implementing the dynamic Tool-Calling Loop with Empathy and Memory.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolDefinitions, toolImplementations } = require('../tools/toolRegistry');
const MemoryEngine = require('../memory/memoryEngine');
const axios = require('axios');

class AgentLoop {
    /**
     * Executes the agentic loop: LLM -> Tool Call(s) -> Tool Execution -> LLM Final Answer.
     * @param {string} userMessage - The current user query.
     * @param {Array} history - The chat history (from SessionState).
     * @param {Object} context - Extra context including userProfile.
     */
    static async run(userMessage, history = [], context = {}) {
        console.log("🚀 AgentLoop: Starting loop for query:", userMessage);

        const profile = context.profile || {};
        const userName = profile.name || "Bhai";
        const userId = context.userId || userName; // Ensure we have a unique identifier

        // 1. FETCH LONG-TERM MEMORIES (Facts)
        let memories = [];
        try {
            memories = await MemoryEngine.searchMemory(userId, userMessage);
            console.log(`🧠 AgentLoop: Retrieved ${memories.length} relevant memories.`);
        } catch (e) {
            console.warn("⚠️ Memory retrieval failed:", e.message);
        }

        const memoryContext = memories.length > 0
            ? `\n# RELEVANT MEMORIES (Past Conversations):\n${memories.map(m => `- [${m.category}] ${m.fact}`).join('\n')}`
            : "";

        const userGender = profile.gender || "Unknown";
        const userEdu = profile.qualification || "Unknown";
        const userLoc = profile.location || "Unknown";

        // Construct the Base System Prompt with Empathy and Profile Context
        const systemPrompt = `
# IMPORTANT: SYSTEM RULES (DO NOT IGNORE)
- **YOU HAVE TWO MODES:**
  1. **TOOL_MODE:** Use this if you need more data (Jobs, Profile updates, etc.). Output ONLY the tool call using the provided API. **STRICT SILENCE**—do not write any conversational text, headings, or greetings during this mode.
  2. **ANSWER_MODE:** Use this ONLY when you have all the necessary data to answer the user completely. Follow the Gemini-style formatting rules below.
- **PARALLEL EXECUTION:** Call all relevant tools in the SAME iteration if possible to save time.
- **NO RAW TAGS:** Do not use any XML-like tags or markdown backticks when calling tools.

# ROLE & PERSONA
You are 'Jobo', a Universal Student Mentor and Career Advisor for Indian students.
You act like a supportive, highly knowledgeable elder brother (Bada Bhai).
Your language is natural, friendly Hinglish. Use words like "Bhai", "Dost".

# USER PROFILE
- Name: ${userName}
- Gender: ${userGender}
- Education: ${userEdu}
- Location: ${userLoc}${memoryContext}

# CORE RULES (LOGIC & REASONING)
1. GENDER & ELIGIBILITY STRICTNESS: ALWAYS check the user's gender and qualification before suggesting a job. If a job is for "Females only" and the user is Male, DO NOT recommend it. Use the exact "Ineligible Reason" from tool results.
2. NO PRE-JUDGMENT: Do NOT provide any eligibility criteria or factual data UNTIL you have received the tool results. Wait for the real data!
3. UNDERSTAND THE "WHY": Acknowledge the user's motivation (e.g., family needs, stress) ONLY in your final response.
4. FINAL ANSWER EMPATHY: Provide 2-3 lines of warm emotional support BEFORE the factual data in your final response.
5. PROACTIVE LEARNING: Call 'update_user_profile' immediately if new info is found.

# FORMATTING & PRESENTATION RULES (STRICT GEMINI-STYLE)
1. THE "BLUF" PRINCIPLE: Always give the direct, complete answer in the very first sentence.
2. HIERARCHICAL STRUCTURE:
   - Use numbered headings for major topics (e.g., **1. Top Job Recommendations**).
   - Under each heading, write 1-2 lines of summary/context first.
   - Then use specific bullet points (-) for the technical details.
   - **CRITICAL:** ALWAYS leave a double empty line (\\n\\n) between different numbered sections.
3. CHUNKING: Never write paragraphs longer than 3 lines. Use **bold text** for keywords.
4. VISUAL ANCHORS: Use emojis (🏢, 📋, 📅, 💰, 🎓, ⚠️) to make the text scannable.
5. ACTIONABILITY: End with a "💡 **Pro Tip:**" and a follow-up question.

# CRITICAL
1. **TOOL CALL SILENCE:** When calling a tool, your output must contain ONLY the tool call. ANY conversational text will cause a system error.
2. **ANSWER ALL PARTS:** Ensure your final response covers all parts of the user's query using data from tool calls.
3. If you are giving the final answer, follow all FORMATTING rules above.
`;

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
        let finalIntent = "GENERAL";
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
                    tools: toolDefinitions,
                    tool_choice: "auto",
                    temperature: 0.3
                };

                const response = await axios.post(baseUrl, payload, {
                    headers,
                    timeout: 60000
                });

                const assistantMessage = response.data.choices[0].message;
                const usage = response.data.usage || {};

                // --- HALLUCINATION FIXER (Emergency Parser) ---
                // If Llama-3 outputs <function=... tags in content, extract them into tool_calls
                if (assistantMessage.content && assistantMessage.content.includes('<function=')) {
                    console.log("⚠️ Hallucination Detected: Extracting tool calls from content.");
                    const regex = /<function=(\w+)>?({[\s\S]*?})<\/function>/g;
                    let match;
                    assistantMessage.tool_calls = assistantMessage.tool_calls || [];

                    while ((match = regex.exec(assistantMessage.content)) !== null) {
                        const [fullMatch, name, argsStr] = match;
                        try {
                            assistantMessage.tool_calls.push({
                                id: `call_hallucinated_${Date.now()}`,
                                type: 'function',
                                function: { name, arguments: argsStr }
                            });
                            // Remove the tag from content so user doesn't see the "ugly" part
                            assistantMessage.content = assistantMessage.content.replace(fullMatch, '').trim();
                        } catch (e) {
                            console.error("❌ Failed to parse hallucinated tool call:", e.message);
                        }
                    }
                }

                console.log(`\n--- [Iteration ${iterations}] AI Response ---`);
                console.log(`Model: ${model}`);
                console.log(`Tokens: In=${usage.prompt_tokens || 0} | Out=${usage.completion_tokens || 0} | Total=${usage.total_tokens || 0}`);

                if (assistantMessage.content) {
                    console.log(`💬 Assistant: ${assistantMessage.content.substring(0, 200)}${assistantMessage.content.length > 200 ? '...' : ''}`);
                }

                if (!assistantMessage.content) assistantMessage.content = "";
                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    console.log(`🎯 Decision: TOOL_CALL (Model wants to fetch data)`);
                    console.log(`🛠️ LLM requested ${assistantMessage.tool_calls.length} tool calls`);

                    for (const toolCall of assistantMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        console.log(`👉 Calling Tool: ${functionName}`);

                        // Infer intent from tool name
                        if (functionName === 'search_jobs') finalIntent = 'JOB_SEARCH';
                        if (functionName === 'get_exam_info') finalIntent = 'EXAM_INFO';
                        if (functionName === 'counsel_student') finalIntent = 'CAREER_GUIDANCE';

                        let functionArgs = {};
                        try {
                            functionArgs = JSON.parse(toolCall.function.arguments);
                            console.log(`📝 Arguments:`, JSON.stringify(functionArgs, null, 2));
                        } catch (e) {
                            console.error("❌ Failed to parse tool arguments:", toolCall.function.arguments);
                        }

                        const implementation = toolImplementations[functionName];
                        let toolResult;

                        if (implementation) {
                            toolResult = await implementation(functionArgs, profile);
                            console.log(`✅ Tool Result Success:`, !!toolResult.success);

                            // Capture data for upstream orchestrator (especially for jobs)
                            if (functionName === 'search_jobs' && toolResult.jobs) {
                                capturedData.jobs = toolResult.jobs;
                                capturedData.documents = toolResult.documents || [];
                            }
                        } else {
                            toolResult = { error: `Tool ${functionName} is not implemented.` };
                            console.error(`❌ Tool ${functionName} not found.`);
                        }

                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: JSON.stringify(toolResult)
                        });
                    }
                    // Continue loop to let LLM process tool results
                } else {
                    console.log(`🎯 Decision: FINAL_REPLY (Model is ready to answer)`);
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
                intent: "GENERAL",
                capturedData
            };
        } catch (error) {
            if (error.response) {
                console.error("❌ AgentLoop LLM Error Status:", error.response.status);
                console.error("❌ AgentLoop LLM Error Data:", JSON.stringify(error.response.data, null, 2));
            }
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
