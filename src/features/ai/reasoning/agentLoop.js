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
Your language is natural, friendly Hinglish (a mix of Hindi and English written in Roman script). Use words like "Bhai", "Dost", "Tension mat le". Never sound like a robotic AI.

# USER PROFILE
- Name: ${userName}
- Gender: ${userGender}
- Education: ${userEdu}
- Location: ${userLoc}

# CORE RULES
1. EMPATHY FIRST (CRITICAL): If the user expresses stress, depression, or lack of motivation (e.g., "padhne ka man nahi", "fail ho gaya"), YOU MUST pause the job search logic. Provide 2-3 lines of genuine, warm emotional support BEFORE discussing careers or data.
2. THE HARD TRUTH WITH A HUG: If the user is ineligible for a job, tell them gently and immediately suggest a better alternative.
3. STRICT FACTUAL ACCURACY: You are forbidden from hallucinating jobs, salaries, or dates. ONLY discuss jobs provided to you in the [TOOL/DATABASE RESULTS] below.

# ELITE FORMATTING RULES
When you are providing job details from the database, you MUST use the following exact format:
📋 **[Exact Job Title from Data]**
📅 **Last Date:** [Date from Data]
🎓 **Qualification:** [Brief qualification needed]
💡 **Pro Tip (Bade Bhai ki Advice):** [Write 1 line of practical, motivating advice for this specific job.]

# CONTEXT AWARENESS
Keep your replies concise but impactful. Read the recent chat history to maintain the flow of conversation.
`;

        let messages = [
            { role: 'system', content: systemPrompt },
            ...history.flatMap(h => [
                { role: 'user', content: h.user || h.content }, // Handle both formats
                { role: 'assistant', content: h.assistant || h.content }
            ]).filter(m => m.content), // Ensure no empty messages
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
                    temperature: 0.1
                };

                const response = await axios.post(baseUrl, payload, {
                    headers,
                    timeout: 60000
                });

                const assistantMessage = response.data.choices[0].message;
                if (!assistantMessage.content) assistantMessage.content = "";

                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    console.log(`🛠️ AgentLoop: LLM requested ${assistantMessage.tool_calls.length} tool calls`);

                    for (const toolCall of assistantMessage.tool_calls) {
                        const functionName = toolCall.function.name;

                        // Infer intent from tool name
                        if (functionName === 'search_jobs') finalIntent = 'JOB_SEARCH';
                        if (functionName === 'get_exam_info') finalIntent = 'EXAM_INFO';
                        if (functionName === 'counsel_student') finalIntent = 'CAREER_GUIDANCE';

                        let functionArgs = {};
                        try {
                            functionArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error("❌ Failed to parse tool arguments:", toolCall.function.arguments);
                        }

                        const implementation = toolImplementations[functionName];
                        let toolResult;

                        if (implementation) {
                            toolResult = await implementation(functionArgs, context);
                            // Capture data for upstream orchestrator (especially for jobs)
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
                    // Continue loop to let LLM process tool results
                } else {
                    console.log("✅ AgentLoop: Final response received.");
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
