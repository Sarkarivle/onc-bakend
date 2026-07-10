/**
 * SessionManager Module
 * Responsibility: Persisting and retrieving user chat history across requests.
 */
const Chat = require('../../chat/chatModel');

class SessionManager {
    /**
     * Fetches the last N messages for a specific session/user.
     */
    static async getHistory(sessionId, limit = 10) {
        try {
            const history = await Chat.find({ sessionId })
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();

            // Reverse to get chronological order [ {user}, {assistant}, ... ]
            return history.reverse().map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        } catch (error) {
            console.error("❌ SessionManager getHistory error:", error.message);
            return [];
        }
    }

    /**
     * Saves a single interaction (User Query + AI Response) to long-term memory.
     */
    static async saveInteraction(userId, sessionId, userMessage, aiResponse) {
        try {
            // --- SANITIZE MULTIMODAL CONTENT FOR DB ---
            const getSafeContent = (content) => {
                if (typeof content === 'string') return content;
                if (Array.isArray(content)) {
                    // Extract text component from multi-modal payload array
                    const textComponent = content.find(item => item.type === "text");
                    return textComponent ? textComponent.text : "[Image Interaction]";
                }
                return String(content || "");
            };

            const interactions = [
                { userName: userId, sessionId, role: 'user', content: getSafeContent(userMessage) },
                { userName: userId, sessionId, role: 'assistant', content: getSafeContent(aiResponse) }
            ];

            await Chat.insertMany(interactions);
            console.log(`💾 Interaction saved for Session: ${sessionId}`);
        } catch (error) {
            console.error("❌ SessionManager saveInteraction error:", error.message);
        }
    }
}

module.exports = SessionManager;
