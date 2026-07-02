/**
 * SemanticRouter Module (Scalable Neural Version)
 * Responsibility: Pure Vector-based routing without hardcoded keywords/anchors.
 * This module now relies on learned similarity rather than manual patterns.
 */
const VectorService = require('../knowledge/vectorService');
const logger = require('../utils/logger');

class SemanticRouter {
    static anchorVectors = new Map();
    static isInitialized = false;

    /**
     * Initializes the router by generating vectors for core concepts once.
     */
    static async init() {
        if (this.isInitialized) return;
        logger.info("🚀 Initializing Neural Semantic Router...");

        const coreConcepts = {
            JOB_SEARCH: "Searching for current job vacancies, recruitment notifications, and active hiring",
            FIELD_DETAILS: "Requesting specific information about salary, eligibility, fees, or exam dates",
            CAREER_GUIDANCE: "Seeking advice on career paths, education choices, or long-term growth",
            RESUME: "Assistance with creating, formatting, or improving a professional CV or Resume",
            PROFILE_INQUIRY: "Questions about user's own identity, age, qualification, or stored data"
        };

        for (const [intent, description] of Object.entries(coreConcepts)) {
            const vector = await VectorService.generate(description);
            this.anchorVectors.set(intent, [vector]);
        }

        this.isInitialized = true;
        logger.info("✅ Neural Semantic Router Initialized.");
    }

    static async route(query, state = {}) {
        await this.init();
        const queryVector = await VectorService.generate(query);

        let bestIntent = null;
        let maxSimilarity = 0;

        for (const [intent, vectors] of this.anchorVectors.entries()) {
            const sim = this._cosineSimilarity(queryVector, vectors[0]);
            if (sim > maxSimilarity) {
                maxSimilarity = sim;
                bestIntent = intent;
            }
        }

        // Only return if similarity is very high to avoid false positives
        if (maxSimilarity > 0.85) {
            logger.info(`⚡ Neural Route: ${bestIntent} | Confidence: ${maxSimilarity.toFixed(3)}`);
            return {
                intent: bestIntent,
                confidence: maxSimilarity,
                needsPlanning: false,
                execution: this._getDefaultExecution(bestIntent)
            };
        }

        return null;
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
        if (intent === 'JOB_SEARCH') return [{ step: 1, tool: "RAG", purpose: "search" }, { step: 2, tool: "LLM", purpose: "synthesis" }];
        return [{ step: 1, tool: "LLM", purpose: "direct response" }];
    }
}

module.exports = SemanticRouter;
