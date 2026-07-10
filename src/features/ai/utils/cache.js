/**
 * Simple In-Memory Cache for AI Advice
 */
class AIResultCache {
    constructor() {
        this.cache = new Map();
        this.TTL = 24 * 60 * 60 * 1000; // 24 hours
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + this.TTL
        });
    }

    generateKey(jobId, user) {
        // Grouping user attributes for cache granularity
        const qualification = (user.educationLevel || user.education || 'N/A').toUpperCase();
        const category = (user.category || 'GENERAL').toUpperCase();
        const gender = (user.gender || 'MALE').toUpperCase();

        // Age Group (e.g., 20-25)
        const age = user.age || 24;
        const ageGroup = Math.floor(age / 5) * 5;

        // Height Group (if physicals matter)
        const height = parseInt(user.height) || 165;
        const heightGroup = Math.floor(height / 5) * 5;

        const state = (user.domicileState || 'UP').replace(/\s+/g, '_').toUpperCase();

        // Versioned to invalidate old caches (Final Fix v14)
        return `matchAdvice_v14:${jobId}:${qualification}:${category}:${gender}:${ageGroup}:${heightGroup}:${state}`;
    }
}

module.exports = new AIResultCache();
