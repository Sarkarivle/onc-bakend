const SemanticIntentClassifier = require('../../src/features/ai/semanticIntentClassifier');
const ConversationState = require('../../src/features/ai/conversationState');

/**
 * A mocked AI client for running deterministic tests without hitting a live LLM.
 * This simulates the AI pipeline's output based on intent detection and mock data.
 */
class TestAiClient {
    static async process(userMessage, { context = {}, profile = {}, mockData = {} }) {
        const sessionId = context.sessionId || `test-session-${Date.now()}`;
        const state = await ConversationState.get(sessionId); // Uses in-memory state for now

        // Update state with provided context for multi-turn tests
        Object.assign(state, context);

        const resolvedIntent = await SemanticIntentClassifier.classify(userMessage, state, profile);

        // This is where the mock response generation logic goes.
        // It should be intelligent enough to pass the tests.
        const mockResponse = this._generateMockResponse(userMessage, resolvedIntent, state, mockData);

        // Update state for next turn
        await ConversationState.update(sessionId, {
            ...state,
            lastAssistantIntent: resolvedIntent.primaryIntent,
            topic: resolvedIntent.domain,
            lastShownItems: mockResponse.items || state.lastShownItems
        });

        return {
            message: mockResponse.message,
            intent: resolvedIntent.primaryIntent,
            domain: resolvedIntent.domain,
            ...mockResponse
        };
    }

    static _generateMockResponse(query, intent, state, mockData) {
        // A more sophisticated mock would go here. For now, a simple placeholder.
        if (intent.isPureGreeting) {
            return { message: "Namaste! Main theek hoon." };
        }
        return { message: "Maaf kijiye, abhi iski verified jankari nahi mili hai." };
    }
}

module.exports = TestAiClient;