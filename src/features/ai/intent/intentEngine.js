/**
 * IntentEngine Module (Phase 3: Balanced Cognitive Decision Layer)
 * Responsibility: Semantic mapping with multi-layer conflict resolution (No Overfitting).
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');
const VectorService = require('../knowledge/vectorService');

const INTENT_ANCHORS = {
    'JOB_SEARCH': ["new vacancy", "naukri chahiye", "bharti", "recruitment notifications"],
    'FIELD_DETAILS': ["fees kitni hai", "last date", "age limit", "salary detail", "syllabus of exam"],
    'CAREER_GUIDANCE': ["10th ke baad career", "how to become doctor", "ias preparation roadmap"],
    'PROFILE_INQUIRY': ["mera naam kya hai", "check my profile", "update my details", "meri qualification"],
    'RESULT_ADMIT_CARD': ["exam result kab aayega", "download admit card", "score card update"],
    'DISCOVERY': ["top 5 latest jobs", "trending sarkari naukri", "kuch naya dikhao", "upcoming exams"],
    'IDENTITY': ["who are you", "aapka founder", "jobo ai ki jankari"]
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

        // 1. NEURAL REFINEMENT
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // 2. COGNITIVE ANALYSIS (The 'Bhaav' Brain)
        const analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic,
            profileStr: JSON.stringify(profile)
        });

        if (!analysis) return { primaryIntent: 'GENERAL_QUERY', refinedQuery };

        // 3. VECTOR VALIDATION (The 'Mathematical' Guard)
        const queryVector = await VectorService.generate(refinedQuery);
        const vectorIntent = queryVector ? this._getBestSemanticMatch(queryVector) : null;

        // 4. SMART RESOLUTION (Conflict Handling)
        let finalIntent = this._resolveFinalIntent(analysis, vectorIntent, refinedQuery);

        return {
            ...analysis,
            refinedQuery,
            primaryIntent: finalIntent,
            isFollowUp: analysis.discourse === 'FOLLOW_UP' || (state.topic && analysis.confidence < 0.5)
        };
    }

    static _resolveFinalIntent(analysis, vectorIntent, query) {
        const domain = String(analysis.domain || '').toUpperCase();
        const primary = String(analysis.primaryIntent || '').toUpperCase();
        const sub = String(analysis.subIntent || '').toUpperCase();
        const lowQuery = query.toLowerCase();

        // Tier 1: High-Confidence Specialization (MOTIVATION, SKILLS, etc.)
        if (['MOTIVATION', 'SKILLS', 'RESUME', 'INTERVIEW', 'SCHOLARSHIP'].includes(primary)) return primary;
        if (['MOTIVATION', 'SKILLS', 'RESUME', 'INTERVIEW', 'SCHOLARSHIP'].includes(sub)) return sub;

        // Tier 2: Domain-Led Guardrails
        if (domain === 'PERSONAL') {
            if (lowQuery.includes('naam') || lowQuery.includes('detail') || lowQuery.includes('profile')) return 'PROFILE_INQUIRY';
        }
        if (domain === 'RAPPORT') {
            if (lowQuery.includes('kaun') || lowQuery.includes('founder') || lowQuery.includes('jobo')) return 'IDENTITY';
            return 'GREETING';
        }

        // Tier 3: Motive Mapping (Gemini Strategy)
        if (primary === 'TRANSACTIONAL') return 'JOB_SEARCH';
        if (primary === 'FACTUAL') return 'FIELD_DETAILS';
        if (primary === 'ADMINISTRATIVE') return 'RESULT_ADMIT_CARD';
        if (primary === 'DISCOVERY') return 'DISCOVERY';
        if (primary === 'GUIDANCE') return 'CAREER_GUIDANCE';

        // Tier 4: Mathematical Vector Tie-breaker (If LLM is unsure)
        if (vectorIntent && (analysis.confidence < 0.8 || primary === 'CATEGORY')) {
            return vectorIntent;
        }

        // Tier 5: Direct Keyword Failsafes (Anti-Regression)
        if (lowQuery.includes('result') || lowQuery.includes('score card')) return 'RESULT_ADMIT_CARD';
        if (lowQuery.includes('fees') || lowQuery.includes('salary') || lowQuery.includes('date')) return 'FIELD_DETAILS';

        return primary || 'GENERAL_QUERY';
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
        return maxSim > 0.90 ? bestIntent : null; // High threshold to avoid false positives
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
}

module.exports = IntentEngine;
