const PromptModule = require('./prompts/promptModel');
const localRegistry = require('./moduleRegistry');

/**
 * PromptManager (Enterprise Logic)
 * Responsibility: Version selection, Caching, and A/B Testing.
 */
class PromptManager {
    static cache = new Map();
    static CACHE_TTL = 300000; // 5 minutes

    /**
     * Fetches the correct version of a prompt module.
     * Supports Fallback to local files for 100% reliability.
     */
    static async getModule(key, sessionId = "") {
        const cacheKey = `${key}_default`;

        // 1. Check Memory Cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.CACHE_TTL) return cached.content;
        }

        try {
            // 2. A/B Testing Logic (Deterministic based on SessionId)
            const modules = await PromptModule.find({ key, isActive: true }).sort({ version: -1 });

            if (modules.length > 0) {
                // Select version based on experiment weight or default
                let selected = modules.find(m => m.isDefault) || modules[0];

                // Deterministic A/B split if experiments exist
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

        // 3. Fallback to Local Files (Zero-Downtime Guarantee)
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
