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
            primaryIntent: primary === 'GREETING' ? 'GREETING' : this._mapToLegacyIntents(primary, analysis.subIntent, refinedQuery)
        };
    }

    static _mapToLegacyIntents(primary, sub, originalQuery) {
        const p = String(primary || '').toUpperCase();
        const lowQuery = String(originalQuery || '').toLowerCase();

        // 🧠 SMART OVERRIDE: Only override if the LLM is already in a "Job-related" context
        const isJobRelated = ['JOB_SEARCH', 'DISCOVERY', 'GENERAL_QUERY', 'FIELD_CHECK'].includes(p);

        if (isJobRelated) {
            // Check for specific detail-oriented keywords
            const hasDetailKeyword = /\b(fees?|paisa|umar|age|limit|salary|vetan|tarikh|date|timeline|eligibility|qualification)\b/i.test(lowQuery);

            // If it's a very short query with a detail keyword, it's almost certainly FIELD_DETAILS
            if (hasDetailKeyword && lowQuery.split(' ').length <= 6) {
                return 'FIELD_DETAILS';
            }

            // Force DISCOVERY for "top/latest" queries if model said JOB_SEARCH
            if (p === 'JOB_SEARCH' && /\b(top|latest|nayi|new|sabse acchi)\b/i.test(lowQuery)) {
                return 'DISCOVERY';
            }
        }

        if (p === 'JOB_SEARCH' || p === 'JOB_QUERY') return 'JOB_SEARCH';
        if (p === 'FIELD_CHECK' || p === 'FIELD_DETAILS') return 'FIELD_DETAILS';
        if (p === 'DISCOVERY') return 'DISCOVERY';
        if (p === 'CAREER_ADVICE' || p === 'CAREER_GUIDANCE') return 'CAREER_GUIDANCE';
        if (p === 'STATUS_CHECK' || p === 'RESULT_ADMIT_CARD') return 'RESULT_ADMIT_CARD';
        if (p === 'PROFILE_INQUIRY' || p === 'PROFILE_INFO' || p === 'PROFILE_CHECK') return 'PROFILE_INQUIRY';
        if (p === 'SCHOLARSHIP') return 'SCHOLARSHIP';
        if (p === 'RESUME') return 'RESUME';
        if (p === 'INTERVIEW') return 'INTERVIEW';
        if (p === 'SKILLS') return 'SKILLS';
        if (p === 'MOTIVATION') return 'MOTIVATION';
        if (p === 'IDENTITY') return 'IDENTITY';
        if (p === 'GREETING') return 'GREETING';

        return primary;
    }
}

module.exports = IntentEngine;
