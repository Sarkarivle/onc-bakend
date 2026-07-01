/**
 * BackgroundServices Module (Architectural Version 2.0)
 * Responsibility: Executing non-blocking tasks (Memory, Learning, Observability)
 * asynchronously after the response is delivered to the user.
 */
const MemoryEngine = require('../memory/memoryEngine');
const Telemetry = require('./telemetryEngine');
const LearningEngine = require('../learning/learningEngine');

class BackgroundServices {
    /**
     * Entry point for all background tasks.
     * Fires and forgets (non-blocking).
     */
    static async runAll(data) {
        const { traceId, userName, userMessage, finalContent, plan, execResult, suggestions } = data;

        // 1. MEMORY INTELLIGENCE ENGINE
        // Extracts facts -> Embeddings -> Stores in Vector DB
        this.runMemoryEngine(userName, userMessage, finalContent).catch(e =>
            console.error("❌ Background Memory Error:", e.message)
        );

        // 2. OBSERVABILITY ENGINE
        // Aggregates Logs, Metrics, and Analytics
        this.runObservabilityEngine(traceId, plan, execResult).catch(e =>
            console.error("❌ Background Observability Error:", e.message)
        );

        // 3. LEARNING ENGINE
        // Analyzes failures, planner accuracy, and feedback
        this.runLearningEngine(traceId, userMessage, finalContent, plan).catch(e =>
            console.error("❌ Background Learning Error:", e.message)
        );
    }

    static async runMemoryEngine(userName, query, response) {
        if (!query || query.length < 5) return;
        // Extraction -> Embedding -> Storage happens inside extractFacts
        await MemoryEngine.extractFacts(userName || "User", query, response);
    }

    static async runObservabilityEngine(traceId, plan, execResult) {
        // Collect metrics from telemetry and finalize report
        const report = Telemetry.endTrace(traceId);
        // Here we could pipe report to an analytics DB or Grafana
        // console.log(`[OBSERVABILITY] Trace ${traceId} Finalized.`);
    }

    static async runLearningEngine(traceId, query, response, plan) {
        // failure detection & planner analytics
        await LearningEngine.processTrace({
            traceId,
            query,
            response,
            intent: plan.intent,
            confidence: plan.confidence
        });
    }
}

module.exports = BackgroundServices;
