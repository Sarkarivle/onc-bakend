/**
 * Metrics Module (Formerly observability/metrics.js)
 * Responsibility: Logs and tracks performance metrics for AI requests.
 */
class Metrics {
    static logRequest(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            latency: data.latency,
            provider: data.provider,
            intent: data.intent,
            confidence: data.confidence,
            searchUsed: !!data.searchUsed,
            status: data.error ? 'ERROR' : 'SUCCESS',
            error: data.error || null
        };

        console.log(`[AI_METRICS] ${JSON.stringify(logEntry)}`);
    }
}

module.exports = Metrics;
