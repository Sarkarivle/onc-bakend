/**
 * ConversationState Module
 * Responsibility: Persist conversation context across turns.
 */
class ConversationState {
    static sessionState = new Map();

    static async get(sessionId) {
        return this.sessionState.get(sessionId) || {
            topic: "GENERAL",
            lastDomain: "GENERAL",
            lastAct: "GREET",
            pendingAction: null,
            turnCount: 0
        };
    }

    /**
     * @param {string[]} acts - Intent acts.
     * @param {string[]} domains - Intent domains.
     * @param {string} aiResponse - Raw response for pending action detection.
     */
    static async update(sessionId, query, acts, domains, aiResponse = "") {
        const currentState = await this.get(sessionId);

        let pendingAction = null;
        const lastMsg = aiResponse.toLowerCase();

        // Generic Question Detection for Pending Actions
        if (lastMsg.match(/(qualification|padhai|education|degree)/)) {
            pendingAction = "WAITING_FOR_QUALIFICATION";
        } else if (lastMsg.match(/(date of birth|dob|birthday|janm)/)) {
            pendingAction = "WAITING_FOR_DOB";
        } else if (lastMsg.match(/(state|location|city|shehar|rehte)/)) {
            pendingAction = "WAITING_FOR_LOCATION";
        } else if (lastMsg.match(/(category|cast|sc|st|obc)/)) {
            pendingAction = "WAITING_FOR_CATEGORY";
        }

        const updatedState = {
            topic: domains[0] || currentState.topic,
            lastDomain: domains[0] !== 'GENERAL' ? domains[0] : currentState.lastDomain,
            lastAct: acts[0],
            pendingAction: pendingAction,
            turnCount: currentState.turnCount + 1,
            updatedAt: Date.now()
        };

        this.sessionState.set(sessionId, updatedState);
        return updatedState;
    }
}

module.exports = ConversationState;
