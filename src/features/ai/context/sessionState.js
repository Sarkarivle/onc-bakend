/**
 * SessionState Module (Formerly ConversationState)
 * Responsibility: Persist conversation context in MongoDB.
 */
const StateModel = require('../memory/stateModel');

class SessionState {
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
        const { query, resolvedIntent, aiResponse, plan, knowledgeContext, userName, insights, turnSummary } = metadata;
        const currentState = await this.get(sessionId);

        let pendingAction = resolvedIntent?.needClarification ? "WAITING_FOR_CLARIFICATION" : null;

        const lastShownJobs = [];
        const jobMatches = (aiResponse || "").match(/\d\.\s+\*\*(.*?)\*\*/g);
        if (jobMatches) {
            jobMatches.forEach(m => lastShownJobs.push(m.replace(/\d\.\s+\*\*/, '').replace(/\*\*/, '').trim()));
        }

        const resolvedDomain = resolvedIntent?.domain || currentState.currentDomain;
        const resolvedTopic = resolvedIntent?.job || resolvedIntent?.entities?.job || (resolvedDomain !== 'GENERAL' ? resolvedDomain : currentState.currentTopic);

        const updateData = {
            sessionId,
            userName,
            topic: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.topic,
            currentTopic: resolvedTopic || currentState.currentTopic,
            currentDomain: resolvedDomain || currentState.currentDomain,
            lastDomain: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.lastDomain,
            lastUserIntent: resolvedIntent?.primaryIntent || currentState.lastUserIntent,
            lastAssistantIntent: plan?.behavior || "RESPOND",
            pendingAction: pendingAction,
            lastShownJobs: lastShownJobs.length > 0 ? lastShownJobs : currentState.lastShownJobs,
            insights: insights || currentState.insights,
            summary: turnSummary || currentState.summary,
            turnCount: (currentState.turnCount || 0) + 1,
            updatedAt: Date.now(),
            $push: {
                history: {
                    $each: [{ user: query, assistant: aiResponse }],
                    $slice: -20
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

module.exports = SessionState;
