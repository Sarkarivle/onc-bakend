/**
 * IntentEngine Module (Phase 3: Hybrid Cognitive Decision Layer)
 * Responsibility: Balancing 'Bhaav' (Semantic) with 'Specifics' (Legacy) to avoid regression.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');
const VectorService = require('../knowledge/vectorService');

// Refined Anchors for all system-supported categories
const INTENT_ANCHORS = {
    'JOB_SEARCH': ["new vacancy", "naukri chahiye", "bharti", "recruitment"],
    'FIELD_DETAILS': ["fees kitni hai", "last date", "age limit", "salary", "syllabus"],
    'CAREER_GUIDANCE': ["10th ke baad kya karein", "how to become doctor", "ias roadmap"],
    'PROFILE_INQUIRY': ["mera naam kya hai", "check my profile", "update education"],
    'RESULT_ADMIT_CARD': ["result kab aayega", "admit card date", "status check"],
    'SCHOLARSHIP': ["up scholarship", "scholarship for students", "financial aid"],
    'RESUME': ["resume kaise banayein", "cv formatting", "bio data"],
    'INTERVIEW': ["interview tips", "crack interview", "mock questions"],
    'IDENTITY': ["who are you", "aapka founder", "jobo ai kaun hai"],
    'MOTIVATION': ["study motivation", "tension ho rahi hai", "encourage me"]
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

        // 1. NEURAL REFINEMENT: Fix typos and expand context WITHOUT losing the soul
        const refinedQuery = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // 2. COGNITIVE ANALYSIS: Deep Bhaav Analysis
        const analysis = await LLMDetector.classify(refinedQuery, {
            topic: state.currentTopic || state.topic,
            profileStr: JSON.stringify(profile)
        });

        if (!analysis) return { primaryIntent: 'GENERAL_QUERY', refinedQuery };

        // 3. VECTOR CONSENSUS: Local mathematical backup
        const queryVector = await VectorService.generate(refinedQuery);
        const vectorIntent = queryVector ? this._getBestSemanticMatch(queryVector) : null;

        // 4. SMART RESOLUTION: Map high-level Motives to Specific System Intents
        // We prioritize Specificity (Legacy) if detected, otherwise fall back to Bhaav (New)
        let finalIntent = this._resolveFinalIntent(analysis, vectorIntent, refinedQuery);

        return {
            ...analysis,
            refinedQuery,
            primaryIntent: finalIntent,
            isFollowUp: analysis.discourse === 'FOLLOW_UP' || (state.topic && analysis.confidence < 0.5)
        };
    }

    static _resolveFinalIntent(analysis, vectorIntent, query) {
        const p = String(analysis.primaryIntent || '').toUpperCase();
        const s = String(analysis.subIntent || '').toUpperCase();
        const lowQuery = query.toLowerCase();

        // Tier 1: Check for very specific keywords in Query (Safest fallback)
        if (lowQuery.includes('resume') || lowQuery.includes('cv')) return 'RESUME';
        if (lowQuery.includes('scholarship')) return 'SCHOLARSHIP';
        if (lowQuery.includes('interview')) return 'INTERVIEW';
        if (lowQuery.includes('skills')) return 'SKILLS';
        if (lowQuery.includes('motivation') || lowQuery.includes('tension')) return 'MOTIVATION';
        if (lowQuery.includes('college')) return 'COLLEGE';

        // Tier 2: Vector Consensus (If vector is very confident, trust it to avoid LLM hallucination)
        if (vectorIntent) return vectorIntent;

        // Tier 3: LLM Cognitive Mapping (Gemini style)
        if (p === 'FACTUAL') return 'FIELD_DETAILS';
        if (p === 'TRANSACTIONAL') return 'JOB_SEARCH';
        if (p === 'GUIDANCE') {
            // Check subIntent for specific guidance types
            if (['RESUME', 'INTERVIEW', 'SCHOLARSHIP', 'SKILLS'].includes(s)) return s;
            return 'CAREER_GUIDANCE';
        }
        if (p === 'PERSISTENCE') return 'PROFILE_INQUIRY';
        if (p === 'ADMINISTRATIVE') return 'RESULT_ADMIT_CARD';
        if (p === 'RAPPORT') {
            if (lowQuery.includes('kaun') || lowQuery.includes('who') || lowQuery.includes('founder')) return 'IDENTITY';
            return 'GREETING';
        }
        if (p === 'DISCOVERY') return 'DISCOVERY';

        // Tier 4: Direct LLM Output (if it's already a system category)
        if (Object.keys(INTENT_ANCHORS).includes(p)) return p;

        return p || 'GENERAL_QUERY';
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
        // Very high threshold for Vector to override LLM
        return maxSim > 0.88 ? bestIntent : null;
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
