const LlamaService = require('./llama.service'); // Assuming this exists for the Llama/RunPod flow
const PromptBuilder = require('./promptBuilder'); // Assuming this exists
const {
  normalizeRequest,
  preLlmChecks,
  postLlmFilter,
  shapeResponse,
  SAFE_RESPONSES
} = require('./brain/aiSafetyGuard');

/**
 * AIService
 * Orchestrates the entire AI request lifecycle, including safety checks,
 * prompt generation, LLM interaction, and response filtering.
 */
class AIService {
  /**
   * Processes the user's request safely.
   * @param {object} requestBody - The raw request body from the controller.
   * @returns {Promise<object>} A promise that resolves to a safe response object.
   */
  static async processRequest(requestBody) {
    // 1. Request Normalization
    const userMessage = normalizeRequest(requestBody);

    // 2. Pre-LLM Safety Gate & Standard Responses
    const preCheckResponse = preLlmChecks(userMessage);
    if (preCheckResponse) {
      // If a pre-check fires (e.g., empty input, injection), return the safe response immediately.
      return { success: true, ...preCheckResponse };
    }

    try {
      // 3. Build the prompt for the LLM
      // The prompt builder should be designed to prevent hallucination of facts.
      const { history = [] } = requestBody;
      const prompt = PromptBuilder.build(userMessage, history);

      // 4. Call the LLM (Llama/RunPod)
      // This part remains unchanged as per the requirements.
      const llmResponseText = await LlamaService.generate(prompt);

      // 5. Post-LLM Safety Filter
      // Scan the response for any leaked data or forbidden content.
      const safeResponseText = postLlmFilter(llmResponseText);

      // 6. Shape the final response
      // Ensure the response has the correct { success, message, answer } structure.
      return shapeResponse(safeResponseText);

    } catch (error) {
      console.error('AI Service Error:', error);
      // Fallback to a generic safe response in case of any internal error.
      return shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK);
    }
  }
}

module.exports = AIService;