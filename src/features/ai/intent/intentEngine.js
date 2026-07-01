/**
 * IntentEngine Module (Phase 3: Deep Cognitive Bridge)
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        // 1. NEURAL REFINEMENT
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic
        });

        // 2. BRAIN ANALYSIS (Direct to LLM)
        const analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic
        });

        if (!analysis || !analysis.primaryIntent) {
            return { primaryIntent: 'GENERAL_QUERY', refinedQuery };
        }

        // 3. NORMALIZATION (Ensuring name consistency with test cases)
        let intent = String(analysis.primaryIntent).toUpperCase();

        // Anti-Regression: Support old 'FIELD_CHECK' and 'JOB_QUERY' names if LLM outputs them
        if (intent === 'FIELD_CHECK') intent = 'FIELD_DETAILS';
        if (intent === 'JOB_QUERY') intent = 'JOB_SEARCH';

        return {
            ...analysis,
            refinedQuery,
            primaryIntent: intent,
            isFollowUp: analysis.discourse === 'FOLLOW_UP' || (refinedQuery.length < 10 && state.topic)
        };
    }
}

module.exports = IntentEngine;
