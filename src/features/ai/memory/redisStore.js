const MemoryStore = require('./memoryStore');

/**
 * Redis Implementation for Production Scalability
 */
class RedisStore extends MemoryStore {
    constructor(redisClient) {
        super();
        this.client = redisClient;
    }

    async get(key) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async set(key, value, ttl = 3600) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    }

    async delete(key) {
        await this.client.del(key);
    }
}

module.exports = RedisStore;
