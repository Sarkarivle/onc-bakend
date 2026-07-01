/**
 * VectorService Module (LOCAL Optimized)
 * Responsibility: Generates vector embeddings locally using all-MiniLM-L6-v2.
 * This keeps search fast and saves GPU resources for the main LLM.
 */
class VectorService {
    static extractor = null;
    static initializing = null;

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
        try {
            await this.init();
            const output = await this.extractor(text, {
                pooling: 'mean',
                normalize: true
            });
            return Array.from(output.data);
        } catch (error) {
            console.error("❌ Local Vector Error:", error.message);
            return null;
        }
    }

    static createJobText(job) {
        return `Job: ${job.title}. Org: ${job.organization}. Cat: ${job.category}. Qual: ${job.eligibility?.education}.`;
    }
}

module.exports = VectorService;
