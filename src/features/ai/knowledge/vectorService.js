/**
 * VectorService Module (LOCAL Optimized)
 * Responsibility: Generates deterministic local semantic vectors without
 * network downloads or native model dependencies.
 */
const logger = require('../utils/logger');
const axios = require('axios');
const { createHash } = require('crypto');

class VectorService {
    static cache = new Map();
    static CACHE_TTL_MS = Number(process.env.EMBEDDING_CACHE_TTL_MS || 10 * 60 * 1000);
    static CACHE_MAX = Number(process.env.EMBEDDING_CACHE_MAX || 500);
    static VECTOR_SIZE = Number(process.env.EMBEDDING_VECTOR_SIZE || 384);
    static _localPipelinePromise = null;
    static _localPipelineFailed = false;

    /**
     * Maintained for compatibility with callers that warm up embedding services.
     * Also eagerly warms the local MiniLM model so the first real request doesn't pay
     * the one-time model-load cost.
     */
    static async init() {
        logger.debug(`VectorService provider: ${this._providerName()}. Local hash fallback always available.`);
        if (this._providerName() === 'local_minilm') {
            this._getLocalPipeline().catch(() => {});
        }
    }

    /**
     * Generates a normalized vector using word and character n-gram hashing.
     */
    static async generate(text) {
        const normalizedText = String(text || "").trim().toLowerCase();
        if (!normalizedText) return null;

        const cached = this.cache.get(normalizedText);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.vector;
        }

        const vector = await this._generateWithProvider(normalizedText) || this._hashText(normalizedText);
        this._setCache(normalizedText, vector);
        return vector;
    }

    static _setCache(key, vector) {
        if (this.cache.size >= this.CACHE_MAX) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { vector, expiresAt: Date.now() + this.CACHE_TTL_MS });
    }

    static createJobText(job) {
        return [
            `Job: ${job.title}`,
            `Org: ${job.organization}`,
            `Category: ${job.category}`,
            `Qualification: ${job.eligibility?.education}`,
            `Age: ${job.eligibility?.ageLimit || `${job.eligibility?.minAge || ''} ${job.eligibility?.maxAge || ''}`}`,
            `Salary: ${job.salary}`,
            `Vacancy: ${job.totalVacancy}`,
            `Content: ${job.aiCoreSummary?.text || job.fullData?.content || ''}`
        ].filter(Boolean).join('. ');
    }

    static cosineSimilarity(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            mA += vecA[i] * vecA[i];
            mB += vecB[i] * vecB[i];
        }
        if (mA === 0 || mB === 0) return 0;
        return dot / (Math.sqrt(mA) * Math.sqrt(mB));
    }

    static async scoreTextPair(query, text) {
        const [queryVector, textVector] = await Promise.all([
            this.generate(query),
            this.generate(text)
        ]);
        return this.cosineSimilarity(queryVector, textVector);
    }

    static _providerName() {
        if (process.env.EMBEDDING_PROVIDER) return process.env.EMBEDDING_PROVIDER.toLowerCase();
        if (process.env.OPENAI_API_KEY && process.env.EMBEDDING_MODEL) return 'openai';
        if (process.env.GEMINI_API_KEY && process.env.EMBEDDING_MODEL) return 'gemini';
        // Default stays local_hash: verified empirically that all-MiniLM-L6-v2 (and its
        // multilingual variant) score romanized Hindi/Hinglish pairs poorly — worse than this
        // hash approach's hardcoded Hinglish synonym table. Set EMBEDDING_PROVIDER=local_minilm
        // to opt into the real local sentence-transformer (better for English-heavy content, or
        // once a custom-trained embedding model is swapped in via EMBEDDING_MODEL).
        // NOTE: switching providers changes vector dimensionality/space — re-run
        // `npm run vectors:jobs` to re-embed stored job documents after switching.
        return 'local_hash';
    }

    static getProviderInfo() {
        const provider = this._providerName();
        const modelNames = {
            openai: 'text-embedding-3-small',
            gemini: 'gemini-embedding-001',
            local_minilm: 'Xenova/all-MiniLM-L6-v2',
            local_hash: 'local_hash_v2'
        };
        return {
            provider,
            model: process.env.EMBEDDING_MODEL || modelNames[provider] || 'local_hash_v2',
            dimensions: this.VECTOR_SIZE
        };
    }

    static textHash(text) {
        return createHash('sha256').update(String(text || '')).digest('hex');
    }

    static async _generateWithProvider(text) {
        const provider = this._providerName();
        if (provider === 'openai') return await this._openAiEmbedding(text);
        if (provider === 'gemini') return await this._geminiEmbedding(text);
        if (provider === 'local_minilm') return await this._localMiniLmEmbedding(text);
        return null;
    }

    /**
     * Runs a real sentence-transformer (all-MiniLM-L6-v2, 384 dims) fully locally via
     * @xenova/transformers (ONNX runtime, CPU). No external API call, no per-request cost.
     * The ONNX weights are downloaded once on first use and cached on disk; if that download
     * fails (e.g. no internet on first boot), we fall back to the hash-based vector below
     * instead of failing the request.
     */
    static async _getLocalPipeline() {
        if (this._localPipelineFailed) return null;
        if (!this._localPipelinePromise) {
            this._localPipelinePromise = (async () => {
                const { pipeline, env } = await import('@xenova/transformers');
                env.allowLocalModels = false;
                return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            })().catch(error => {
                logger.warn(`Local MiniLM embedding model failed to load, falling back to hash vectors: ${error.message}`);
                this._localPipelineFailed = true;
                this._localPipelinePromise = null;
                return null;
            });
        }
        return this._localPipelinePromise;
    }

    static async _localMiniLmEmbedding(text) {
        try {
            const extractor = await this._getLocalPipeline();
            if (!extractor) return null;
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (error) {
            logger.warn(`Local MiniLM embedding error, falling back to hash vector: ${error.message}`);
            return null;
        }
    }

    static async _openAiEmbedding(text) {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
        if (!apiKey || process.env.EMBEDDING_PROVIDER === 'local_hash') return null;

        try {
            const response = await axios.post('https://api.openai.com/v1/embeddings', {
                model,
                input: text
            }, {
                timeout: Number(process.env.EMBEDDING_TIMEOUT_MS || 8000),
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            });
            const vector = response.data?.data?.[0]?.embedding;
            return this._normalizeExternalVector(vector);
        } catch (error) {
            logger.warn(`Embedding provider fallback: ${error.message}`);
            return null;
        }
    }

    static async _geminiEmbedding(text) {
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
        if (!apiKey || process.env.EMBEDDING_PROVIDER === 'local_hash') return null;

        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
                { content: { parts: [{ text }] } },
                { timeout: Number(process.env.EMBEDDING_TIMEOUT_MS || 8000) }
            );
            const vector = response.data?.embedding?.values;
            return this._normalizeExternalVector(vector);
        } catch (error) {
            logger.warn(`Embedding provider fallback: ${error.message}`);
            return null;
        }
    }

    static _normalizeExternalVector(vector) {
        if (!Array.isArray(vector) || vector.length === 0) return null;
        const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + Number(value || 0) ** 2, 0));
        if (magnitude === 0) return null;
        return vector.map(value => Number(value || 0) / magnitude);
    }

    static _hashText(text) {
        const vector = new Array(this.VECTOR_SIZE).fill(0);
        const tokens = this._tokens(text);

        for (const token of tokens) {
            this._addFeature(vector, token, 1.0);
            for (const gram of this._charNgrams(token)) {
                this._addFeature(vector, gram, 0.45);
            }
        }

        const synonyms = this._semanticAliases(tokens);
        for (const alias of synonyms) {
            this._addFeature(vector, alias, 0.75);
        }

        const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (magnitude === 0) return vector;
        return vector.map(value => value / magnitude);
    }

    static _tokens(text) {
        return text
            .replace(/\bgovt\b/g, "government")
            .replace(/\bsarkari\b/g, "government")
            .replace(/\bnaukri\b/g, "job")
            .replace(/\bbharti\b/g, "recruitment")
            .replace(/\byojna\b/g, "scheme")
            .replace(/\byojana\b/g, "scheme")
            .replace(/\bchatravriti\b/g, "scholarship")
            .replace(/\bvidyarthi\b/g, "student")
            .replace(/\btaiyari\b/g, "preparation")
            .split(/[^a-z0-9]+/i)
            .map(token => token.trim())
            .filter(token => token.length > 1)
            .slice(0, 64);
    }

    static _charNgrams(token) {
        const padded = `_${token}_`;
        const grams = [];
        for (let size = 3; size <= 4; size++) {
            for (let index = 0; index <= padded.length - size; index++) {
                grams.push(padded.slice(index, index + size));
            }
        }
        return grams;
    }

    static _semanticAliases(tokens) {
        const aliases = [];
        const joined = tokens.join(' ');
        const groups = [
            { match: ['job', 'jobs', 'vacancy', 'vacancies', 'bharti', 'recruitment'], alias: 'government_job_search' },
            { match: ['sarkari', 'government', 'naukri'], alias: 'government_job_search' },
            { match: ['ssc', 'cgl', 'chsl', 'mts', 'gd'], alias: 'ssc_exam_jobs' },
            { match: ['railway', 'rrb', 'alp'], alias: 'railway_jobs' },
            { match: ['police', 'constable', 'daroga'], alias: 'police_jobs' },
            { match: ['bank', 'banking', 'ibps', 'sbi', 'clerk', 'po'], alias: 'banking_jobs' },
            { match: ['teacher', 'teaching', 'ctet', 'tet'], alias: 'teaching_jobs' },
            { match: ['upsc', 'ias', 'civil'], alias: 'upsc_jobs' },
            { match: ['10th', 'tenth', 'highschool'], alias: 'class_10_eligible' },
            { match: ['12th', 'inter', 'intermediate'], alias: 'class_12_eligible' },
            { match: ['graduate', 'degree'], alias: 'graduate_eligible' },
            { match: ['result', 'admit', 'answer', 'key'], alias: 'exam_status_document' },
            { match: ['scholarship', 'scheme', 'yojna'], alias: 'student_financial_support' },
            { match: ['career', 'course', 'skill', 'resume', 'interview'], alias: 'career_guidance' },
            { match: ['age', 'eligibility', 'qualification', 'fee', 'salary', 'syllabus'], alias: 'job_detail_field' }
        ];

        for (const group of groups) {
            if (group.match.some(term => joined.includes(term))) aliases.push(group.alias);
        }

        return aliases;
    }

    static _addFeature(vector, feature, weight) {
        const hash = this._hash(feature);
        const index = Math.abs(hash) % vector.length;
        const sign = hash % 2 === 0 ? 1 : -1;
        vector[index] += sign * weight;
    }

    static _hash(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash | 0;
    }
}

module.exports = VectorService;
