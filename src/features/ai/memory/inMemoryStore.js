const MemoryStore = require('./memoryStore');

/**
 * Standard In-Memory Store (Dev only)
 */
class InMemoryStore extends MemoryStore {
    constructor() {
        super();
        this.cache = new Map();
    }

    async get(key) {
        return this.cache.get(key) || null;
    }

    async set(key, value, ttl) {
        this.cache.set(key, value);
        // Basic TTL simulation if needed
    }

    async delete(key) {
        this.cache.delete(key);
    }
}

module.exports = InMemoryStore;
