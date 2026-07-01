/**
 * IntentEngine Module (Phase 3: Neural Intent Detection)
 * Responsibility: Semantic classification of motives and entity extraction.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');
const VectorService = require('../knowledge/vectorService');

// Semantic Anchors for Ultra-Fast Intent Mapping (Bhaav-based)
const INTENT_ANCHORS = {
    'JOB_SEARCH': ["new vacancy", "naukri chahiye", "bharti", "recruitment notifications"],
    'FIELD_DETAILS': ["fees kitni hai", "last date", "age limit", "salary kitni milegi", "syllabus"],
    'CAREER_GUIDANCE': ["10th ke baad kya karein", "how to become doctor", "ias preparation", "roadmap"],
    'PROFILE_INQUIRY': ["mera naam kya hai", "check my profile", "update qualification"],
    'RESULT_ADMIT_CARD': ["result kab aayega", "admit card date", "status check"]
};

class IntentEngine {
    static anchorVectors = new Map();
    static isInitialized = false;

    static async _init() {
        if (this.isInitialized) return;
        for (const [intent, examples] of Object.entries(INTENT_ANCHORS)) {
            const vectors = await Promise.all(examples.map(ex => VectorService.generate(ex)));
            this.anchorVectors.set(intent, vectors.filter(v => v !== null));
        }
        this.isInitialized = true;
    }

    static async classify(query, state = {}, profile = {}) {
        await this._init();
        const queryVector = await VectorService.generate(query);

        // 1. NEURAL REFINEMENT
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // 2. COGNITIVE ANALYSIS (LLM + Vector)
        let analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic,
            profile,
            turnCount: state.turnCount
        });

        // 3. SEMANTIC CORRECTION (If LLM is unsure, Vector decides)
        if (analysis.confidence < 0.7 && queryVector) {
            const bestIntent = this._getBestSemanticMatch(queryVector);
            if (bestIntent) analysis.primaryIntent = bestIntent;
        }

        return {
            ...analysis,
            refinedQuery,
            isFollowUp: analysis.discourse === 'FOLLOW_UP' || (state.topic && analysis.confidence < 0.5),
            primaryIntent: this._mapToLegacyIntents(analysis.primaryIntent, analysis.subIntent, refinedQuery)
        };
    }

    static _getBestSemanticMatch(queryVec) {
        let maxSim = 0;
        let bestIntent = null;
        for (const [intent, anchors] of this.anchorVectors.entries()) {
            for (const anchor of anchors) {
                const sim = this._cosineSimilarity(queryVec, anchor);
                if (sim > maxSim) {
                    maxSim = sim;
                    bestIntent = intent;
                }
            }
        }
        return maxSim > 0.85 ? bestIntent : null;
    }

    static _cosineSimilarity(vecA, vecB) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            mA += vecA[i] * vecA[i];
            mB += vecB[i] * vecB[i];
        }
        return (mA && mB) ? dot / (Math.sqrt(mA) * Math.sqrt(mB)) : 0;
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
