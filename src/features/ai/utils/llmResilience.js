/**
 * Protects the LLM provider from being hammered when traffic spikes.
 *
 * At scale, a naive "1 request in = 1 LLM call out" design means N concurrent
 * users translate directly into N concurrent outbound calls to a provider
 * that has its own RPM/concurrency limits (Groq, RunPod, etc). Once that
 * limit is hit, the provider starts returning 429s; without anything here,
 * every in-flight retry just re-hits the same wall, making the outage worse.
 *
 * Two independent pieces:
 *  - LLMQueue: caps how many LLM HTTP calls are in flight at once from this
 *    process. Extra calls wait in a FIFO queue instead of firing immediately.
 *  - CircuitBreaker: after repeated consecutive failures, stops sending new
 *    requests for a cooldown window and fails fast instead - giving the
 *    provider room to recover instead of getting retried into the ground.
 */

class LLMQueue {
    constructor(maxConcurrent) {
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        this.pending = [];
    }

    run(fn) {
        return new Promise((resolve, reject) => {
            const task = async () => {
                this.active++;
                try {
                    resolve(await fn());
                } catch (err) {
                    reject(err);
                } finally {
                    this.active--;
                    this._next();
                }
            };
            this.pending.push(task);
            this._next();
        });
    }

    _next() {
        if (this.active >= this.maxConcurrent) return;
        const task = this.pending.shift();
        if (task) task();
    }

    getStats() {
        return { active: this.active, queued: this.pending.length, maxConcurrent: this.maxConcurrent };
    }
}

class CircuitBreaker {
    constructor({ failureThreshold, cooldownMs }) {
        this.failureThreshold = failureThreshold;
        this.cooldownMs = cooldownMs;
        this.consecutiveFailures = 0;
        this.openUntil = 0;
    }

    isOpen() {
        return Date.now() < this.openUntil;
    }

    recordSuccess() {
        this.consecutiveFailures = 0;
        this.openUntil = 0;
    }

    recordFailure() {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.failureThreshold) {
            this.openUntil = Date.now() + this.cooldownMs;
        }
    }
}

// Exponential backoff with full jitter, honoring a provider's Retry-After
// header (seconds or HTTP-date) on 429s when present instead of guessing.
function backoffDelayMs(attempt, error, { baseMs = 1000, maxMs = 15000 } = {}) {
    const retryAfterHeader = error?.response?.headers?.['retry-after'];
    if (retryAfterHeader) {
        const asSeconds = Number(retryAfterHeader);
        if (!Number.isNaN(asSeconds)) return Math.min(asSeconds * 1000, maxMs);
        const asDate = Date.parse(retryAfterHeader);
        if (!Number.isNaN(asDate)) return Math.max(0, Math.min(asDate - Date.now(), maxMs));
    }
    const exp = Math.min(maxMs, baseMs * 2 ** attempt);
    return Math.random() * exp;
}

const llmQueue = new LLMQueue(Number(process.env.LLM_MAX_CONCURRENT || 20));
const llmCircuitBreaker = new CircuitBreaker({
    failureThreshold: Number(process.env.LLM_CIRCUIT_FAILURE_THRESHOLD || 8),
    cooldownMs: Number(process.env.LLM_CIRCUIT_COOLDOWN_MS || 15000),
});

module.exports = { llmQueue, llmCircuitBreaker, backoffDelayMs };
