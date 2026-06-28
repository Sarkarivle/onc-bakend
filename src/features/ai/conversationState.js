/**
 * ConversationState Module
 * Responsibility: Persist conversation context across turns.
 */
class ConversationState {
    static sessionState = new Map();

    static async get(sessionId) {
        return this.sessionState.get(sessionId) || {
            topic: "GENERAL",
            currentTopic: "GENERAL",
            currentDomain: "GENERAL",
            lastDomain: "GENERAL",
            lastAct: "GREET",
            lastUserIntent: "GENERAL",
            lastAssistantIntent: "GENERAL",
            lastAssistantQuestion: null,
            pendingAction: null,
            lastDataResult: "NONE",
            lastFailureReason: null,
            lastShownJobs: [],
            lastShownItems: [],
            lastShownItemType: "NONE",
            lastFilters: {},
            lastResultCount: 0,
            totalAvailableCount: 0,
            remainingCount: 0,
            nextOffset: 0,
            lastVerifiedStatus: false,
            lastSourceUsed: "NONE",
            lastUserGoal: "NONE",
            turnCount: 0,
            history: [] // Last 5 turns for context
        };
    }

    /**
     * @param {Object} metadata - { query, acts, domains, intents, aiResponse, plan, knowledgeContext, validation, resolvedIntent }
     */
    static async update(sessionId, metadata) {
        const { query, acts, domains, intents, aiResponse, plan, knowledgeContext, validation, resolvedIntent } = metadata;
        const currentState = await this.get(sessionId);

        let pendingAction = resolvedIntent?.needClarification ? "WAITING_FOR_CLARIFICATION" : null;
        let lastAssistantQuestion = null;
        const lastMsg = (aiResponse || "").toLowerCase();

        // Generic Question Detection for Pending Actions
        if (!pendingAction) {
            const questionMatch = lastMsg.match(/\?$/) || lastMsg.includes('?') || lastMsg.match(/(bataiye|puchiye|denge|karenge)/);
            if (questionMatch) {
                if (lastMsg.match(/(qualification|padhai|education|degree)/)) {
                    pendingAction = "WAITING_FOR_QUALIFICATION";
                    lastAssistantQuestion = "QUALIFICATION";
                } else if (lastMsg.match(/(date of birth|dob|birthday|janm)/)) {
                    pendingAction = "WAITING_FOR_DOB";
                    lastAssistantQuestion = "DOB";
                } else if (lastMsg.match(/(state|location|city|shehar|rehte)/)) {
                    pendingAction = "WAITING_FOR_LOCATION";
                    lastAssistantQuestion = "LOCATION";
                } else if (lastMsg.match(/(category|cast|sc|st|obc)/)) {
                    pendingAction = "WAITING_FOR_CATEGORY";
                    lastAssistantQuestion = "CATEGORY";
                } else if (lastMsg.includes('full details') || lastMsg.includes('jankari chahiye')) {
                    pendingAction = "WAITING_FOR_DETAILS_CONFIRMATION";
                    lastAssistantQuestion = "DETAILS_CONFIRMATION";
                }
            }
        }

        const lastDataResult = (knowledgeContext?.jobs || knowledgeContext?.web) ? "SUCCESS" : "NO_VERIFIED_DATA";
        const lastFailureReason = lastDataResult === "NO_VERIFIED_DATA" ? "NO_ACTIVE_VERIFIED_RECORD" : null;

        // Extract last shown jobs for follow-up
        const lastShownJobs = [];
        const jobMatches = aiResponse.match(/\d\.\s+\*\*(.*?)\*\*/g);
        if (jobMatches) {
            jobMatches.forEach(m => lastShownJobs.push(m.replace(/\d\.\s+\*\*/, '').replace(/\*\*/, '').trim()));
        }

        const resolvedDomain = resolvedIntent?.domainIntent || domains?.[0] || currentState.currentDomain;
        const resolvedTopic = resolvedIntent?.referencedTopic || (resolvedDomain !== 'GENERAL' ? resolvedDomain : currentState.currentTopic);
        const totalAvailableCount = Number(knowledgeContext?.count || lastShownJobs.length || currentState.totalAvailableCount || 0);
        const nextOffset = plan?.pagination?.offset != null
            ? Number(plan.pagination.offset) + Number(plan.pagination.limit || 10)
            : (lastShownJobs.length > 0 ? currentState.nextOffset + lastShownJobs.length : currentState.nextOffset);
        const remainingCount = Math.max(0, totalAvailableCount - nextOffset);

        const updatedState = {
            ...currentState,
            topic: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.topic,
            currentTopic: resolvedTopic || currentState.currentTopic,
            currentDomain: resolvedDomain || currentState.currentDomain,
            lastDomain: resolvedDomain !== 'GENERAL' && resolvedDomain !== 'NONE' ? resolvedDomain : currentState.lastDomain,
            lastUserIntent: resolvedIntent?.primaryIntent || intents?.[0] || currentState.lastUserIntent,
            lastAssistantIntent: plan?.behavior || "RESPOND",
            lastAssistantQuestion: lastAssistantQuestion,
            pendingAction: pendingAction,
            lastDataResult: lastDataResult,
            lastFailureReason: lastFailureReason,
            lastShownJobs: lastShownJobs.length > 0 ? lastShownJobs : currentState.lastShownJobs,
            lastShownItems: lastShownJobs.length > 0 ? lastShownJobs : currentState.lastShownItems,
            lastShownItemType: lastShownJobs.length > 0 ? "JOB" : (resolvedDomain === 'SCHOLARSHIP' ? 'SCHOLARSHIP' : currentState.lastShownItemType),
            lastFilters: plan?.pagination?.lastFilters || currentState.lastFilters,
            lastVerifiedStatus: validation?.passed || false,
            lastSourceUsed: (knowledgeContext?.jobs ? "DATABASE" : (knowledgeContext?.web ? "SEARCH" : "NONE")),
            lastUserGoal: resolvedIntent?.resolvedIntent || resolvedDomain || currentState.lastUserGoal,
            lastResultCount: lastShownJobs.length,
            totalAvailableCount,
            remainingCount,
            nextOffset,
            turnCount: currentState.turnCount + 1,
            updatedAt: Date.now(),
            history: [...currentState.history, { user: query, assistant: aiResponse }].slice(-5)
        };

        this.sessionState.set(sessionId, updatedState);
        return updatedState;
    }
}

module.exports = ConversationState;
