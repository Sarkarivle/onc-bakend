/**
 * Metrics Service
 * Tracks enterprise-level AI performance.
 */
class Metrics {
    static logRequest(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            latency: data.latency,
            tokens: data.tokens || { prompt: 0, completion: 0 },
            provider: data.provider,
            intent: data.intent,
            confidence: data.confidence,
            searchUsed: !!data.searchUsed,
            status: data.error ? 'ERROR' : 'SUCCESS',
            error: data.error || null
        };

        // Production: Send to ELK Stack, Datadog, or CloudWatch
        console.log(`[AI_METRICS] ${JSON.stringify(logEntry)}`);
    }
}

module.exports = Metrics;
