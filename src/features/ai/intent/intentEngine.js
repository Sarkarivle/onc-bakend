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

        // Level 1: Strict Domain Steering (Prevents Overfitting)
        if (domain === 'PERSONAL') {
            if (lowQuery.includes('naam') || lowQuery.includes('qualification') || lowQuery.includes('profile') || lowQuery.includes('update')) {
                return 'PROFILE_INQUIRY';
            }
        }
        if (domain === 'RAPPORT') {
            if (lowQuery.includes('kaun') || lowQuery.includes('who') || lowQuery.includes('founder') || lowQuery.includes('identity')) {
                return 'IDENTITY';
            }
            return 'GREETING';
        }

        // Level 2: High-Confidence Vector Match (Failsafe for short queries)
        // If vector matches and LLM is unsure or general, trust Vector
        if (vectorIntent && (analysis.confidence < 0.85 || primary === 'GENERAL_QUERY')) {
            return vectorIntent;
        }

        // Level 3: Semantic Bhaav Mapping (Gemini Mapping)
        const mapping = {
            'TRANSACTIONAL': 'JOB_SEARCH',
            'FACTUAL': 'FIELD_DETAILS',
            'GUIDANCE': 'CAREER_GUIDANCE',
            'ADMINISTRATIVE': 'RESULT_ADMIT_CARD',
            'PERSISTENCE': 'PROFILE_INQUIRY',
            'DISCOVERY': 'DISCOVERY',
            'RAPPORT': 'GREETING'
        };

        let resolved = mapping[primary] || primary;

        // Level 4: Specific Sub-Intent Overrides (Fine-tuning)
        if (resolved === 'CAREER_GUIDANCE') {
            if (['RESUME', 'INTERVIEW', 'SCHOLARSHIP', 'SKILLS', 'COLLEGE'].includes(sub)) return sub;
            if (lowQuery.includes('resume') || lowQuery.includes('cv')) return 'RESUME';
            if (lowQuery.includes('scholarship')) return 'SCHOLARSHIP';
        }

        // Fix for 'Result' and 'Fees' specific edge cases
        if (lowQuery.includes('result') || lowQuery.includes('admit card') || lowQuery.includes('score card')) return 'RESULT_ADMIT_CARD';
        if (lowQuery.includes('fees') || lowQuery.includes('salary') || lowQuery.includes('age limit')) return 'FIELD_DETAILS';

        return resolved || 'GENERAL_QUERY';
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
