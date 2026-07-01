/**
 * SemanticIntentClassifier Module
 * Responsibility: Uses vector embeddings to find the best intent match for a query
 * from a registry of examples. This provides a flexible, semantic understanding
 * that complements the rigid rules of the deterministic resolver.
 */
const EmbeddingService = require('../embedding/embeddingService');
const IntentExampleRegistry = require('./intentExampleRegistry');
const { cosineSimilarity } = require('../../../utils/mathUtils');

class SemanticIntentClassifier {
    constructor() {
        this.intentEmbeddings = null;
    }

    /**
     * Pre-computes and caches embeddings for all intent examples.
     * This should be called once at application startup.
     */
    async initialize() {
        if (this.intentEmbeddings) {
            return;
        }

        console.log('🧠 Initializing Semantic Intent Classifier: Caching intent example embeddings...');
        const registry = IntentExampleRegistry.getRegistry();
        this.intentEmbeddings = {};

        for (const intent in registry) {
            const examples = registry[intent];
            if (examples.length > 0) {
                // In a real scenario, you might batch these calls.
                const embeddings = await EmbeddingService.generate(examples);
                this.intentEmbeddings[intent] = embeddings;
            }
        }
        console.log('✅ Semantic Intent Classifier initialized.');
    }

    /**
     * Classifies the user's query by finding the intent with the highest
     * cosine similarity to the query's embedding.
     */
    async classify(query) {
        if (!this.intentEmbeddings) {
            console.warn('SemanticIntentClassifier not initialized. Call initialize() first.');
            await this.initialize(); // Lazy initialization
        }

        const queryEmbedding = await EmbeddingService.generate([query]);
        if (!queryEmbedding || queryEmbedding.length === 0) {
            return this._createFallbackResponse('Could not generate query embedding.');
        }

        let bestMatch = { intent: 'FALLBACK', score: 0.0 };

        for (const intent in this.intentEmbeddings) {
            const exampleEmbeddings = this.intentEmbeddings[intent];
            for (const exampleEmbedding of exampleEmbeddings) {
                const score = cosineSimilarity(queryEmbedding[0], exampleEmbedding);
                if (score > bestMatch.score) {
                    bestMatch = { intent, score };
                }
            }
        }

        // Confidence threshold
        if (bestMatch.score < 0.75) { // Tune this threshold based on testing
            return this._createFallbackResponse(`Low confidence semantic match (${bestMatch.score.toFixed(2)})`);
        }

        return this._createResponse(bestMatch.intent, bestMatch.score);
    }

    _createResponse(intent, confidence) {
        const metadata = IntentExampleRegistry.getMetadata(intent) || {};
        return {
            rawIntent: intent,
            normalizedIntent: intent,
            intent: intent,
            domain: metadata.domainIntent || 'GENERAL',
            act: 'INFORM',
            mode: 'FALLBACK', // Planner will override this
            behavior: 'RESPOND', // Planner will override this
            confidence: confidence,
            slots: {},
            needsClarification: false,
            reasoningShort: `Semantic match: ${intent} (Score: ${confidence.toFixed(2)})`
        };
    }

    _createFallbackResponse(reason) {
        return this._createResponse('FALLBACK', 0.1);
    }
}

// Export a singleton instance to maintain the cache
module.exports = new SemanticIntentClassifier();