/**
 * SemanticRouter Module (Phase 2 Speed Optimization)
 * Responsibility: Near-instant intent detection using local embeddings.
 * This skips the Intent LLM call for common request patterns.
 */
const VectorService = require('../knowledge/vectorService');

const INTENT_ANCHORS = {
    JOB_SEARCH: [
        "latest government jobs", "ssc railway vacancies", "12th pass naukri",
        "sarkari bharti list", "bank exams notification", "police job apply link",
        "army agniveer vacancy", "high court jobs", "upsc civil services",
        "nayi bharti kab aayegi", "jobs for graduates", "part time jobs",
        "female candidate vacancies", "bihar police vacancy", "running me mere liye jobs",
        "kuch aur h kya mere liye", "iske alaba jobs"
    ],
    FIELD_DETAILS: [
        "exam syllabus kya hai", "application fees kitni hai", "last date kab hai",
        "eligibility criteria", "age limit kitni hai", "salary kitni milegi",
        "physical standard for police", "how to apply online", "selection process"
    ],
    PROFILE_INQUIRY: [
        "meri age kya h", "m abhi kitne sal ka hu", "meri qualification kya hai",
        "mera naam kya hai", "meri profile dikhao", "my age and category"
    ],
    CAREER_GUIDANCE: [
        "10th ke baad kya kare", "best career after 12th commerce", "ias kaise bane",
        "software engineer ki padhai", "government vs private job guide",
        "career options for biology students", "graduation ke baad kya scope hai"
    ],
    ORDINAL_FOLLOWUP: [
        "2 no bali job", "pehle wali job", "1 number wali", "second option",
        "more details on 3rd", "details of 2", "dusri wali", "pehli wali details",
        "details about number 2", "more info on 1"
    ],
    RESUME: [
        "resume kaise banaye", "cv format download", "resume building tips",
        "professional summary for resume", "resume me kya likhe"
    ]
};

class SemanticRouter {
    static anchorVectors = new Map();
    static isInitialized = false;

    static async init() {
        if (this.isInitialized) return;
        console.log("🚀 Initializing Semantic Router (Turbo Mode)...");
        for (const [intent, examples] of Object.entries(INTENT_ANCHORS)) {
            const vectors = await Promise.all(examples.map(ex => VectorService.generate(ex)));
            this.anchorVectors.set(intent, vectors.filter(v => v !== null));
        }
        this.isInitialized = true;
    }

    static async route(query, state = {}) {
        await this.init();

        // CONTEXT ENRICHMENT: Prepend current topic to query to prevent confusion
        const currentTopic = state.currentTopic || state.topic || "GENERAL";
        const enrichedQuery = `[Topic: ${currentTopic}] ${query}`;

        const queryVector = await VectorService.generate(enrichedQuery);
        if (!queryVector) return null;

        let bestIntent = null;
        let highestScore = 0;

        for (const [intent, anchors] of this.anchorVectors.entries()) {
            const score = this._getMaxSimilarity(queryVector, anchors);
            if (score > highestScore) {
                highestScore = score;
                bestIntent = intent;
            }
        }

        // Manual override for common profile confusion (Age vs Result)
        const q = query.toLowerCase();
        if (q.includes('age') || q.includes('kitne saal') || q.includes('umar')) {
            bestIntent = 'PROFILE_INQUIRY';
            highestScore = Math.max(highestScore, 0.9);
        }

        // High confidence threshold for bypassing LLM
        if (highestScore > 0.8) {
            console.log(`⚡ Semantic Route: ${bestIntent} (Score: ${highestScore.toFixed(3)}) | Context: ${currentTopic}`);
            return {
                intent: bestIntent,
                confidence: highestScore,
                needsPlanning: false,
                execution: this._getDefaultExecution(bestIntent),
                mode: this._getMode(bestIntent),
                searchStrategy: {
                    skipLlmExpansion: true,
                    skipLlmRerank: true,
                    reason: "Fast Semantic Route"
                }
            };
        }

        return null;
    }

    static _getMaxSimilarity(queryVec, anchors) {
        let max = 0;
        for (const anchor of anchors) {
            const sim = this._cosineSimilarity(queryVec, anchor);
            if (sim > max) max = sim;
        }
        return max;
    }

    static _cosineSimilarity(vecA, vecB) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            mA += vecA[i] * vecA[i];
            mB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(mA) * Math.sqrt(mB));
    }

    static _getDefaultExecution(intent) {
        // ALWAYS include MEMORY tool to ensure follow-up context is never lost
        const base = [{ step: 1, tool: "MEMORY", purpose: "load history" }];

        if (intent === 'JOB_SEARCH' || intent === 'ORDINAL_FOLLOWUP') {
            return [...base, { step: 2, tool: "RAG", purpose: "search" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        if (intent === 'FIELD_DETAILS') {
            return [...base, { step: 2, tool: "RAG", purpose: "details" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        if (intent === 'PROFILE_INQUIRY') {
            return [...base, { step: 2, tool: "PROFILE", purpose: "fetch user profile" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        return [...base, { step: 2, tool: "LLM", purpose: "direct response" }];
    }

    static _getMode(intent) {
        const mapping = {
            'JOB_SEARCH': 'JOB_SEARCH',
            'FIELD_DETAILS': 'JOB_DETAILS',
            'ORDINAL_FOLLOWUP': 'JOB_DETAILS',
            'PROFILE_INQUIRY': 'PROFILE_HELP',
            'CAREER_GUIDANCE': 'CAREER_GUIDANCE',
            'RESUME': 'RESUME_HELP'
        };
        return mapping[intent] || 'GENERAL_HELP';
    }
}

module.exports = SemanticRouter;
