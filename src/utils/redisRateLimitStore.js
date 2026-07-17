const { getRedis } = require('../config/redis');

/**
 * express-rate-limit v7 Store, backed by Redis so the limit is shared across
 * every instance behind the load balancer (the default in-memory store gives
 * each instance its own counter - with N instances a user effectively gets
 * N times the intended limit).
 *
 * Deliberately lazy: Redis connects asynchronously after this app boots
 * (see server.js), so this must never touch Redis at construction time.
 * Every call also falls back to a local in-memory counter on any Redis
 * error/unavailability, so a Redis blip degrades to "per-instance limiting"
 * instead of crashing or blocking all traffic.
 */
class RedisRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60 * 60 * 1000;
    this.localHits = new Map();
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const client = getRedis();
    const fullKey = this.prefix + key;

    if (client) {
      try {
        const totalHits = await client.incr(fullKey);
        if (totalHits === 1) {
          await client.pExpire(fullKey, this.windowMs);
        }
        const ttl = await client.pTTL(fullKey);
        const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
        return { totalHits, resetTime };
      } catch (err) {
        // Fall through to the local fallback below.
      }
    }

    const now = Date.now();
    const entry = this.localHits.get(key);
    if (!entry || entry.resetTime <= now) {
      const resetTime = now + this.windowMs;
      this.localHits.set(key, { count: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }
    entry.count += 1;
    return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
  }

  async decrement(key) {
    const client = getRedis();
    const fullKey = this.prefix + key;
    if (client) {
      try {
        await client.decr(fullKey);
        return;
      } catch (err) {
        // Fall through to local fallback below.
      }
    }
    const entry = this.localHits.get(key);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }

  async resetKey(key) {
    const client = getRedis();
    const fullKey = this.prefix + key;
    if (client) {
      try {
        await client.del(fullKey);
      } catch (err) {
        // Ignore - key will simply expire via TTL.
      }
    }
    this.localHits.delete(key);
  }
}

module.exports = RedisRateLimitStore;
