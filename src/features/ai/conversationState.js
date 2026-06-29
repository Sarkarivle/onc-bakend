const StateModel = require('./memory/stateModel');

/**
 * ConversationState Module
 * Responsibility: Persist conversation context in MongoDB for long-term memory.
 */
class ConversationState {
    static async get(sessionId) {
        let state = await StateModel.findOne({ sessionId });

        if (!state) {
            return {
                topic: "GENERAL",
                currentTopic: "GENERAL",
                currentDomain: "GENERAL",
                lastDomain: "GENERAL",
                history: [],
                turnCount: 0
            };
        }

        return state.toObject();
    }

    static async update(sessionId, metadata) {
        const { query, acts, domains, intents, aiResponse, plan, knowledgeContext, validation, resolvedIntent, userName } = metadata;
        const currentState = await this.get(sessionId);

        let pendingAction = resolvedIntent?.needClarification ? "WAITING_FOR_CLARIFICATION" : null;

        const lastShownJobs = [];
        const jobMatches = (aiResponse || "").match(/\d\.\s+\*\*(.*?)\*\*/g);
        if (jobMatches) {
            jobMatches.forEach(m => lastShownJobs.push(m.replace(/\d\.\s+\*\*/, '').replace(/\*\*/, '').trim()));
        }

        const resolvedDomain = resolvedIntent?.domainIntent || domains?.[0] || currentState.currentDomain;
        const resolvedTopic = resolvedIntent?.referencedTopic || (resolvedDomain !== 'GENERAL' ? resolvedDomain : currentState.currentTopic);

        const updateData = {
            sessionId,
            userName,
            topic: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.topic,
            currentTopic: resolvedTopic || currentState.currentTopic,
            currentDomain: resolvedDomain || currentState.currentDomain,
            lastDomain: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.lastDomain,
            lastUserIntent: resolvedIntent?.primaryIntent || intents?.[0] || currentState.lastUserIntent,
            lastAssistantIntent: plan?.behavior || "RESPOND",
            pendingAction: pendingAction,
            lastShownJobs: lastShownJobs.length > 0 ? lastShownJobs : currentState.lastShownJobs,
            turnCount: (currentState.turnCount || 0) + 1,
            updatedAt: Date.now(),
            $push: {
                history: {
                    $each: [{ user: query, assistant: aiResponse }],
                    $slice: -20 // Store last 20 messages for context
                }
            }
        };

        return await StateModel.findOneAndUpdate(
            { sessionId },
            updateData,
            { upsert: true, new: true }
        );
    }
}

module.exports = ConversationState;
