/**
 * IntentEngine Module (Phase 2-B: Neural Query Completion)
 * Responsibility: Coordinating AI-driven refinement and intent detection.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        // 1. NEURAL REFINEMENT: Fix typos and complete adhoora sawal
        // Example: "fees?" -> "Delhi Police ki fees kya hai?"
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        console.log(`🧠 Query Evolution: "${query}" -> "${refinedQuery}"`);

        // 2. NEURAL INTENT DETECTION: Use the "Perfected" query
        const analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic,
            profile,
            turnCount: state.turnCount
        });

        if (!analysis) {
            return {
                primaryIntent: 'GENERAL_QUERY',
                discourse: 'NEW_TOPIC',
                confidence: 0.1,
                reasoning: 'Analysis Failed'
            };
        }

        return {
            ...analysis,
            refinedQuery, // Pass this along so RAG knows exactly what to search
            isFollowUp: analysis.discourse === 'FOLLOW_UP',
            usePreviousContext: analysis.discourse === 'FOLLOW_UP',
            primaryIntent: analysis.primaryIntent === 'GREETING' ? 'GREETING' : this._mapToLegacyIntents(analysis.primaryIntent, analysis.subIntent)
        };
    }

    static _mapToLegacyIntents(primary, sub) {
        if (primary === 'JOB_SEARCH') return 'JOB_QUERY';
        if (primary === 'FIELD_CHECK' || sub === 'FEES' || sub === 'AGE_LIMIT') return 'FIELD_DETAILS';
        if (primary === 'CAREER_ADVICE') return 'CAREER_GUIDANCE';
        if (primary === 'STATUS_CHECK') return 'RESULT_ADMIT_CARD';
        return primary;
    }
}

module.exports = IntentEngine;
