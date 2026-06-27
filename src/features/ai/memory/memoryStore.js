/**
 * MemoryStore Interface
 */
class MemoryStore {
    async get(key) { throw new Error("Method not implemented"); }
    async set(key, value, ttl) { throw new Error("Method not implemented"); }
    async delete(key) { throw new Error("Method not implemented"); }
}

module.exports = MemoryStore;
