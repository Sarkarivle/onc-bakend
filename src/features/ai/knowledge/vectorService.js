/**
 * VectorService Module (LOCAL Optimized)
 * Responsibility: Generates deterministic local semantic vectors without
 * network downloads or native model dependencies.
 */
const logger = require('../utils/logger');

class VectorService {
    static cache = new Map();
    static CACHE_TTL_MS = Number(process.env.EMBEDDING_CACHE_TTL_MS || 10 * 60 * 1000);
    static CACHE_MAX = Number(process.env.EMBEDDING_CACHE_MAX || 500);
    static VECTOR_SIZE = Number(process.env.EMBEDDING_VECTOR_SIZE || 384);

    /**
     * Maintained for compatibility with callers that warm up embedding services.
     */
    static async init() {
        logger.debug("VectorService uses deterministic local vectors; no model warmup required.");
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

        const vector = this._hashText(normalizedText);
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
        return `Job: ${job.title}. Org: ${job.organization}. Cat: ${job.category}. Qual: ${job.eligibility?.education}.`;
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
