/**
 * LLMProvider Interface (Abstract)
 * Ensures all LLM adapters follow the same contract.
 */
class LLMProvider {
    async chat(messages, options) {
        throw new Error("Method 'chat()' must be implemented.");
    }
}

module.exports = LLMProvider;
