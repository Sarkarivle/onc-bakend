const InMemoryStore = require('./memory/inMemoryStore');
const RedisStore = require('./memory/redisStore');
const Settings = require('../settings/settingsModel');

/**
 * ConversationState (Stateless Orchestrator)
 */
class ConversationState {
    static store = null;

    static async _getStore() {
        if (this.store) return this.store;

        const redisUrl = await Settings.findOne({ key: 'REDIS_URL' });
        if (redisUrl && redisUrl.value) {
            // Production: Initialize Redis
            // const redis = require('redis').createClient({ url: redisUrl.value });
            // this.store = new RedisStore(redis);
            console.log("🚀 [MEMORY] Redis Store Initialized (Simulated)");
            this.store = new InMemoryStore(); // Fallback for now
        } else {
            console.log("🏠 [MEMORY] Using In-Memory Store");
            this.store = new InMemoryStore();
        }
        return this.store;
    }

    static async get(sessionId) {
        const store = await this._getStore();
        return await store.get(`state:${sessionId}`) || { topic: "", lastIntent: null };
    }

    static async update(sessionId, query, intents) {
        const store = await this._getStore();
        const currentState = await this.get(sessionId);

        let newTopic = currentState.topic;
        const jobKeywords = ['ssc', 'upsc', 'railway', 'police', 'gd', 'cgl', 'chsl', 'mts', 'army', 'constable', 'daroga'];
        const q = query.toLowerCase();

        for (const word of jobKeywords) {
            if (q.includes(word)) {
                const match = q.match(new RegExp(`(${word}\\s+\\w+)`, 'i'));
                newTopic = match ? match[0].toUpperCase() : word.toUpperCase();
                break;
            }
        }

        const updatedState = {
            topic: newTopic,
            lastIntent: intents[0],
            updatedAt: Date.now()
        };

        await store.set(`state:${sessionId}`, updatedState, 3600); // 1-hour TTL
        return updatedState;
    }
}

module.exports = ConversationState;
