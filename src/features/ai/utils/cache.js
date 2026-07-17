const { getRedis } = require('../../../config/redis');

/**
 * AI Advice Cache - Redis-backed so a cache hit on one server instance is
 * visible to every other instance behind the load balancer. With N instances
 * and a purely in-memory cache, each instance recomputes (and re-pays the LLM
 * cost for) the same key independently - hit rate effectively drops by ~N.
 *
 * Falls back to a local in-memory cache on any Redis error/unavailability,
 * so a Redis blip degrades to "per-instance caching" instead of breaking.
 */
class AIResultCache {
    constructor() {
        this.localCache = new Map();
        this.TTL_SECONDS = 24 * 60 * 60; // 24 hours
    }

    _redisKey(key) {
        return `ai:advice:${key}`;
    }

    async get(key) {
        const redis = getRedis();
        if (redis) {
            try {
                const raw = await redis.get(this._redisKey(key));
                return raw ? JSON.parse(raw) : null;
            } catch (err) {
                // Fall through to the local fallback below.
            }
        }

        const entry = this.localCache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.localCache.delete(key);
            return null;
        }
        return entry.data;
    }

    async set(key, data) {
        const redis = getRedis();
        if (redis) {
            try {
                await redis.set(this._redisKey(key), JSON.stringify(data), { EX: this.TTL_SECONDS });
                return;
            } catch (err) {
                // Fall through to the local fallback below.
            }
        }

        this.localCache.set(key, { data, expiry: Date.now() + this.TTL_SECONDS * 1000 });
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

        // Versioned to invalidate old caches (v25 - Hyper Personalized)
        return `matchAdvice_v25:${jobId}:${qualification}:${category}:${gender}:${ageGroup}:${heightGroup}:${state}`;
    }
}

module.exports = new AIResultCache();
