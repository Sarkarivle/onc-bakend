/**
 * PromptManager Module
 * Responsibility: Manages system prompt modules, versioning, and caching.
 */
const PromptModule = require('../memory/promptModel');
const localRegistry = require('./moduleRegistry');

class PromptManager {
    static cache = new Map();
    static CACHE_TTL = 300000;

    static async getModule(key, sessionId = "") {
        const cacheKey = `${key}_default`;

        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.CACHE_TTL) return cached.content;
        }

        try {
            const modules = await PromptModule.find({ key, isActive: true }).sort({ version: -1 });

            if (modules.length > 0) {
                let selected = modules.find(m => m.isDefault) || modules[0];

                const experiments = modules.filter(m => m.experimentWeight > 0);
                if (experiments.length > 0 && sessionId) {
                    const hash = this._simpleHash(sessionId);
                    let cumulativeWeight = 0;
                    for (const exp of experiments) {
                        cumulativeWeight += exp.experimentWeight;
                        if (hash % 100 < cumulativeWeight) {
                            selected = exp;
                            break;
                        }
                    }
                }

                this.cache.set(cacheKey, { content: selected.content, time: Date.now() });
                return selected.content;
            }
        } catch (err) {
            console.error(`❌ PromptManager Error for ${key}:`, err.message);
        }

        return localRegistry[key] || "";
    }

    static _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

module.exports = PromptManager;
