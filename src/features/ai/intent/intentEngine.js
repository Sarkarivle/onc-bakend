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
        let analysis = await LLMDetector.classify(refinedQuery, {
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

        // Handle case where LLM returns a string instead of JSON object
        if (typeof analysis === 'string') {
            console.log(`[INTENT_RECOVERY] LLM returned string, attempting to wrap: "${analysis}"`);
            analysis = {
                primaryIntent: analysis.toUpperCase().includes('GREETING') ? 'GREETING' :
                               analysis.toUpperCase().includes('JOB_SEARCH') ? 'JOB_SEARCH' :
                               analysis.toUpperCase().includes('FIELD') ? 'FIELD_CHECK' : 'GENERAL_QUERY',
                reasoning: 'Recovered from string response'
            };
        }

        // Safety: Ensure primaryIntent is a string and handle object returns from some LLM versions
        let primary = analysis.primaryIntent || analysis.intent;
        if (typeof primary === 'object' && primary !== null) {
            primary = primary.name || primary.intent || 'GENERAL_QUERY';
        }

        if (!primary) primary = 'GENERAL_QUERY';

        return {
            ...analysis,
            refinedQuery,
            isFollowUp: analysis.discourse === 'FOLLOW_UP',
            usePreviousContext: analysis.discourse === 'FOLLOW_UP',
            primaryIntent: primary === 'GREETING' ? 'GREETING' : this._mapToLegacyIntents(primary, analysis.subIntent)
        };
    }

    static _mapToLegacyIntents(primary, sub) {
        const p = String(primary || '').toUpperCase();
        const s = String(sub || '').toUpperCase();

        if (p === 'JOB_SEARCH' || p === 'JOB_QUERY') return 'JOB_SEARCH';
        if (p === 'FIELD_CHECK' || p === 'FIELD_DETAILS' || s === 'FEES' || s === 'AGE_LIMIT') return 'FIELD_DETAILS';
        if (p === 'CAREER_ADVICE' || p === 'CAREER_GUIDANCE') return 'CAREER_GUIDANCE';
        if (p === 'STATUS_CHECK' || p === 'RESULT_ADMIT_CARD') return 'RESULT_ADMIT_CARD';
        if (p === 'PROFILE_INQUIRY' || p === 'PROFILE_INFO' || p === 'PROFILE_CHECK') return 'PROFILE_INQUIRY';

        return primary;
    }
}

module.exports = IntentEngine;
