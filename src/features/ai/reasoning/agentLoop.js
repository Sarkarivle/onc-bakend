/**
 * AgentLoop Module (Architectural Version 2.0 - Universal Mentor Architecture)
 * Responsibility: Implementing the dynamic Tool-Calling Loop with Empathy and Memory.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolDefinitions, toolImplementations } = require('../tools/toolRegistry');
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
        const userGender = profile.gender || "Unknown";
        const userEdu = profile.qualification || "Unknown";
        const userLoc = profile.location || "Unknown";

        // Construct the Base System Prompt with Empathy and Profile Context
        const systemPrompt = `
# ROLE & PERSONA
You are 'Jobo', a Universal Student Mentor and Career Advisor for Indian students.
You act like a supportive, highly knowledgeable elder brother (Bada Bhai).
Your language is natural, friendly Hinglish. Use words like "Bhai", "Dost".

# USER PROFILE
- Name: ${userName}
- Gender: ${userGender}
- Education: ${userEdu}
- Location: ${userLoc}

# CORE RULES
1. EMPATHY FIRST: If the user is stressed, provide 2-3 lines of emotional support BEFORE anything else.
2. ELIGIBILITY: If ineligible, be gentle and suggest alternatives.
3. FACTUAL: ONLY discuss jobs provided in tool results. Do not hallucinate.

# FORMATTING (ONLY FOR FINAL RESPONSE)
When providing job details, use this format:
📋 **[Job Title]**
📅 **Last Date:** [Date]
🎓 **Qualification:** [Brief]
💡 **Pro Tip (Bade Bhai ki Advice):** [1 line advice]

# TOOL CALLING & FALLBACK RULES
1. If you need external data, call the relevant tool exactly ONCE.
2. IF A TOOL FAILS or returns an error (e.g., "live search kaam nahi kar rahi"), DO NOT attempt to call the tool again.
3. If a tool fails, gracefully apologize to the user in natural Hinglish and explain that the system could not fetch the specific info right now.
4. CRITICAL: NEVER output raw XML, HTML, or <function> tags under any circumstances. Always stick to the standard tool-calling JSON format.
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
        const maxIterations = 3;
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

                console.log(`\n--- [Iteration ${iterations}] AI Response ---`);
                console.log(`Model: ${model}`);
                console.log(`Tokens: In=${usage.prompt_tokens || 0} | Out=${usage.completion_tokens || 0} | Total=${usage.total_tokens || 0}`);

                if (assistantMessage.content) {
                    console.log(`💬 Assistant: ${assistantMessage.content.substring(0, 200)}${assistantMessage.content.length > 200 ? '...' : ''}`);
                }

                if (!assistantMessage.content) assistantMessage.content = "";
                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
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
