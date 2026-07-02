/**
 * VectorService Module (LOCAL Optimized)
 * Responsibility: Generates vector embeddings locally using all-MiniLM-L6-v2.
 * This keeps search fast and saves GPU resources for the main LLM.
 */
class VectorService {
    static extractor = null;
    static initializing = null;
    static cache = new Map();
    static CACHE_TTL_MS = Number(process.env.EMBEDDING_CACHE_TTL_MS || 10 * 60 * 1000);
    static CACHE_MAX = Number(process.env.EMBEDDING_CACHE_MAX || 500);

    /**
     * Loads the model into local server memory.
     */
    static async init() {
        if (this.extractor) return;
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            try {
                const { pipeline } = await import('@xenova/transformers');
                console.log("⏳ Loading Local Search Model (all-MiniLM-L6-v2)...");
                this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
                console.log("✅ Local Search Model Ready.");
            } finally {
                this.initializing = null;
            }
        })();

        return this.initializing;
    }

    /**
     * Generates a vector using local CPU/RAM.
     */
    static async generate(text) {
        const normalizedText = String(text || "").trim().toLowerCase();
        if (!normalizedText) return null;

        const cached = this.cache.get(normalizedText);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.vector;
        }

        try {
            await this.init();
            const output = await this.extractor(text, {
                pooling: 'mean',
                normalize: true
            });
            const vector = Array.from(output.data);
            this._setCache(normalizedText, vector);
            return vector;
        } catch (error) {
            console.error("❌ Local Vector Error:", error.message);
            return null;
        }
    }

    static _setCache(key, vector) {
        if (this.cache.size >= this.CACHE_MAX) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { vector, expiresAt: Date.now() + this.CACHE_TTL_MS });
    }

    static createJobText(job) {
        return `Job: ${job.title}. Org: ${job.organization}. Cat: ${job.category}. Qual: ${job.eligibility?.education}.`;
    }
}

module.exports = VectorService;
