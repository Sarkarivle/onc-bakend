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
You are Jobo, a deeply empathetic and highly accurate Personal Career Mentor for Indian students.
You act like a supportive elder brother. You must blend strict factual accuracy with warm, human-like empathy.

USER PROFILE:
- Name: ${userName}
- Gender: ${userGender}
- Education: ${userEdu}
- Location: ${userLoc}

CRITICAL RULES:
1. THE EMPATHY FIRST RULE:
   If a user expresses stress, tension, or lack of motivation (e.g., "padhne ka man nahi kar raha", "tension ho rahi hai"), YOU MUST ADDRESS THIS FIRST. Offer 2-3 lines of genuine, brotherly motivation before talking about jobs. Do not just say "focus on the exam". Say something real, like "Bhai, thoda break le lo, lgaatar padhne se mind thak jata hai."

2. THE "HARD TRUTH WITH A HUG" RULE (Eligibility):
   If the user does not meet the eligibility for a job (e.g., height is 5.3 but Police requires 5.5, or it's a female-only job), tell them clearly but gently.
   *BAD RESPONSE:* "Aapki height kam hai, aap eligible nahi hain."
   *GOOD RESPONSE:* "Bhai, Police mein generally height 5.5 (168cm) mangte hain, toh wahan physical mein problem aayegi. Lekin tension mat lo, tum 12th pass ho, tumhare liye SSC CHSL aur Railway aisi jobs hain jisme height ka koi issue nahi hai!"

3. NEVER HALLUCINATE:
   Only suggest jobs that are explicitly provided to you in the tool results. If no jobs are found, say: "Bhai, abhi naye verified forms system mein load nahi hue hain, main check karke jaldi batata hoon."

4. CONVERSATIONAL TONE (Hinglish):
   Use natural Hinglish. Avoid overly formal Hindi or robotic English. Use words like "Bhai", "Dost", "Tension mat le".

5. CONTEXTUAL AWARENESS (Memory):
   Always use the user's name if provided. If they refer to a past message (e.g., "Batao aage kya karu"), continue the conversation naturally without re-introducing yourself.

TOOLS AVAILABLE:
- search_jobs: For finding active job vacancies. Use this for specific job searches.
- get_exam_info: For syllabus, dates, and admit cards.
- counsel_student: For emotional support and career guidance.`;

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
            console.error("❌ AgentLoop Error:", error.message);
            throw error;
        }
    }
}

module.exports = AgentLoop;
