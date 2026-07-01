/**
 * IntentEngine Module (Phase 3: Clean-Slate Neural Intelligence)
 * Responsibility: Zero-logic routing. Trusting the Example-based Brain.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');

class IntentEngine {
    static async classify(query, state = {}, profile = {}) {
        // 1. NEURAL REFINEMENT: Fix typos and expand context
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // 2. NEURAL DETECTION: High-precision categorization
        const analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic
        });

        if (!analysis || !analysis.primaryIntent) {
            return { primaryIntent: 'GENERAL_QUERY', refinedQuery };
        }

        // 3. CLEAN MAPPING: Ensure final intent is a valid system key
        let finalIntent = String(analysis.primaryIntent).toUpperCase();

        // Final Safety Normalization (The only logic remaining)
        if (finalIntent === 'SPECIALIZED_GUIDANCE') {
            const sub = String(analysis.subIntent || '').toUpperCase();
            if (['RESUME', 'INTERVIEW', 'SCHOLARSHIP', 'SKILLS'].includes(sub)) finalIntent = sub;
            else finalIntent = 'CAREER_GUIDANCE';
        }

        return {
            ...analysis,
            refinedQuery,
            primaryIntent: finalIntent,
            isFollowUp: analysis.discourse === 'FOLLOW_UP' || (state.topic && (refinedQuery.length < 10))
        };
    }
}

module.exports = IntentEngine;
