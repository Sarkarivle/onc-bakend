/**
 * AgentLoop Module (Architectural Version 1.0)
 * Responsibility: Implementing the Tool-Calling Loop for dynamic reasoning.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { toolDefinitions, toolImplementations } = require('../tools/toolRegistry');
const axios = require('axios');

class AgentLoop {
    /**
     * Executes the agentic loop: LLM -> Tool Call -> Tool Execution -> LLM Final Answer.
     */
    static async run(userMessage, history = [], context = {}) {
        console.log("🚀 AgentLoop: Starting loop for query:", userMessage);

        let messages = [
            {
                role: 'system',
                content: `You are Jobo, the Universal Student Mentor.
                Your goal is to help students with:
                1. Job Search (using search_jobs tool)
                2. Exam Information (using get_exam_info tool)
                3. Emotional Support/Counseling (using counsel_student tool)
                4. General Career Advice.

                Guidelines:
                - Use tools whenever specific data is needed.
                - Speak in friendly, motivational Hinglish.
                - If the student is sad or unmotivated, PRIORITIZE counsel_student tool.
                - Address the user as 'Bhai' or 'Dost'.`
            },
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: userMessage }
        ];

        let iterations = 0;
        const maxIterations = 3; // Prevent infinite loops

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

                // OpenAI/Groq might return null content when tool_calls are present
                if (assistantMessage.content === null) assistantMessage.content = "";

                messages.push(assistantMessage);

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    console.log(`🛠️ AgentLoop: LLM requested ${assistantMessage.tool_calls.length} tool calls`);

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
                            toolResult = await implementation(functionArgs, context);
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
                    // Continue loop to give tool results back to LLM
                } else {
                    // No more tool calls, we have the final response
                    console.log("✅ AgentLoop: Final response received.");
                    return assistantMessage.content;
                }
            }

            return "Bhai, kaafi koshish ki par sahi jawab nahi nikal paya. Ek baar phir se try karein?";
        } catch (error) {
            console.error("❌ AgentLoop Error:", error.message);
            if (error.response) console.error("API Error Body:", JSON.stringify(error.response.data, null, 2));
            throw error;
        }
    }
}

module.exports = AgentLoop;
