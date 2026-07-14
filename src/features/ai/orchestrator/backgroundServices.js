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

        const traceReport = Telemetry.getTrace(traceId);

        // 1. MEMORY INTELLIGENCE ENGINE
        this.runMemoryEngine(userName, userMessage, finalContent).catch(e =>
            console.error("❌ Background Memory Error:", e.message)
        );

        // 2. OBSERVABILITY ENGINE
        // Aggregates Logs, Metrics, and Analytics
        this.runObservabilityEngine(traceReport, plan, execResult).catch(e =>
            console.error("❌ Background Observability Error:", e.message)
        );

        // 3. LEARNING ENGINE
        // Analyzes failures, planner accuracy, and feedback
        this.runLearningEngine(traceReport, userMessage, finalContent, plan).catch(e =>
            console.error("❌ Background Learning Error:", e.message)
        );
    }

    static async runMemoryEngine(userName, query, response) {
        if (!query || query.length < 5) return;
        // Extraction -> Embedding -> Storage happens inside extractFacts
        await MemoryEngine.extractFacts(userName || "User", query, response);
    }

    static async runObservabilityEngine(traceReport, plan, execResult) {
        if (!traceReport) return;
        // Here we could pipe report to an analytics DB or Grafana
        // console.log(`[OBSERVABILITY] Trace ${traceReport.traceId} Finalized.`);
    }

    static async runLearningEngine(traceReport, query, response, plan) {
        if (!traceReport) return;
        // failure detection & planner analytics
        await LearningEngine.processTrace({
            ...traceReport,
            query,
            response,
            intent: plan.intent,
            confidence: plan.confidence
        });
    }
}

module.exports = BackgroundServices;
