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
- **STRICT SILENCE:** If you are calling a tool, you MUST NOT write any conversational text. No "Bhai", no "Dost", no "Searching...". ONLY output the JSON tool call.
- **PARALLEL EXECUTION:** If a user asks multiple questions (e.g., job search + career advice), you MUST call all relevant tools in the SAME iteration or consecutive iterations BEFORE giving the final answer.
- NEVER use XML tags like <function> or <tool>. Use the JSON tool-calling feature.
- If a tool is not available or fails, inform the user in Hinglish ONLY in your final response.

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
1. UNDERSTAND THE "WHY": Always look for the emotional reason or motivation behind a user's query (e.g., financial stress, family responsibility, career confusion). Acknowledge this in your final response.
2. ELIGIBILITY TRUTH: NEVER contradict the eligibility engine. If the tool result says a user is ineligible for a job because of education/age, you MUST state that same reason. Do NOT hallucinate criteria.
3. FINAL ANSWER EMPATHY: Only in your FINAL response, if the user seems stressed or mentions personal struggles, provide 2-3 lines of warm emotional support BEFORE the factual data.
4. MULTI-INTENT HANDLING: If the message contains multiple questions, ensure ALL are answered in the final response. If tools are needed for different parts, call them all.
5. FACTUAL: ONLY discuss jobs provided in tool results. If no jobs are found, explain why based on the user's profile.
6. PROACTIVE LEARNING: If the user mentions a NEW qualification, skill, or location, you MUST call 'update_user_profile' immediately.
7. NO REPETITION: Do not call the same tool with the same arguments more than once.

# FORMATTING & PRESENTATION RULES (STRICT)
1. THE "BLUF" PRINCIPLE (Bottom Line Up Front): Always give the direct answer or main explanation in the very first sentence. No long, boring introductions.
2. HIERARCHICAL STRUCTURE (Gemini-Style):
   - Use numbered headings for major topics (e.g., **1. Eligibility for Aanganwadi**).
   - Under each heading, provide 1-2 lines of context followed by specific bullet points (-) for details.
   - **CRITICAL:** ALWAYS leave a double empty line between different sections.
3. CHUNKING & BOLDING: Never write paragraphs longer than 3 lines. Use **bold text** to highlight important keywords (like Dates, Salaries, Job Names, Degree names).
4. VISUAL ANCHORS (Emojis): Use emojis to guide the user's eyes (🏢, 📋, 📅, 💰, 🎓, ⚠️).
5. DYNAMIC TONE:
   - For explanations: Use a structured, authoritative yet friendly "Gemini-like" layout.
   - For emotional support: Write warm, conversational Hinglish sentences like a caring elder brother. Do NOT use bullet points for emotional support sections.
6. ACTIONABILITY: Always end with a "💡 **Pro Tip:**" and a specific follow-up question.

# CRITICAL
1. **TOOL CALL SILENCE:** If you are calling a tool, you MUST NOT write any conversational text. ONLY output the JSON tool call. Failure to do this will break the system.
2. **ANSWER ALL PARTS:** If the user asked 2 or 3 things, ensure your final response covers all of them using data from tool calls.
3. If you are giving the final answer, follow all FORMATTING rules above.
4. NEVER output raw function tags like <function>.
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
