/**
 * TelemetryEngine Module (Architectural Version 11.0)
 * Responsibility: Enterprise-grade observability, tracing, and metrics.
 * Built on OpenTelemetry standards for Google Cloud/Datadog/Grafana compatibility.
 */
const { randomUUID } = require('crypto');

class TelemetryEngine {
    constructor() {
        this.traces = new Map();
    }

    /**
     * Initializes a new request trace.
     */
    startTrace(userId, sessionId, initialInput, requestId = null) {
        const traceId = requestId || randomUUID();
        const trace = {
            traceId,
            userId,
            sessionId,
            startTime: Date.now(),
            stages: [],
            metrics: {
                totalTokens: 0,
                totalCost: 0,
                toolCalls: 0,
                retries: 0
            },
            context: {
                initialQuery: initialInput
            }
        };
        this.traces.set(traceId, trace);
        return traceId;
    }

    /**
     * Records the start and end of a specific module stage.
     */
    async trackStage(traceId, moduleName, action) {
        const trace = this.traces.get(traceId);
        if (!trace) return await action();

        const stage = {
            module: moduleName,
            startTime: Date.now(),
            status: 'IN_PROGRESS'
        };
        trace.stages.push(stage);

        try {
            const result = await action();
            stage.endTime = Date.now();
            stage.duration = stage.endTime - stage.startTime;
            stage.status = 'SUCCESS';
            return result;
        } catch (error) {
            stage.endTime = Date.now();
            stage.duration = stage.endTime - stage.startTime;
            stage.status = 'FAILED';
            stage.error = error.message;
            throw error;
        }
    }

    /**
     * Logs specific event metadata (e.g., Intent, RAG Results).
     */
    logEvent(traceId, module, metadata) {
        const trace = this.traces.get(traceId);
        if (!trace) return;

        const stage = trace.stages.find(s => s.module === module && s.status === 'SUCCESS');
        if (stage) {
            stage.metadata = { ...stage.metadata, ...metadata };
        }
    }

    setContext(traceId, metadata = {}) {
        const trace = this.traces.get(traceId);
        if (!trace) return;
        trace.context = { ...trace.context, ...metadata };
    }

    /**
     * Finalizes the trace and returns the full report.
     */
    endTrace(traceId) {
        const trace = this.traces.get(traceId);
        if (!trace) return null;

        trace.endTime = Date.now();
        trace.totalDuration = trace.endTime - trace.startTime;
        trace.summary = this._buildSummary(trace);

        // Structured Logging for External Collectors (ELK/Splunk)
        console.log(`[TELEMETRY_TRACE] ${JSON.stringify(trace)}`);

        // Cleanup to prevent memory leaks
        this.traces.delete(traceId);
        return trace;
    }

    _buildSummary(trace) {
        const durationFor = (...names) => trace.stages
            .filter(stage => names.includes(stage.module))
            .reduce((sum, stage) => sum + (stage.duration || 0), 0);

        return {
            requestId: trace.traceId,
            sessionId: trace.sessionId,
            userId: trace.userId,
            latencyMs: trace.totalDuration,
            plannerTimeMs: durationFor('QUERY_UNDERSTANDING_ENGINE', 'PLANNER_ENGINE', 'COGNITIVE_CONTROLLER'),
            searchTimeMs: durationFor('SEARCH', 'RAG_RETRIEVER', 'EXECUTION_ENGINE'),
            ragTimeMs: durationFor('RAG_RETRIEVER', 'EXECUTION_ENGINE'),
            llmTimeMs: durationFor('FINAL_LLM'),
            promptBuilderTimeMs: durationFor('PROMPT_BUILDER'),
            safetyTimeMs: durationFor('GATEWAY_VALIDATION', 'SAFETY_GUARDRAILS', 'VALIDATION_ENGINE'),
            errors: trace.stages.filter(stage => stage.status === 'FAILED').map(stage => ({
                module: stage.module,
                error: stage.error
            })),
            confidence: trace.context?.confidence || null,
            intent: trace.context?.intent || null
        };
    }

    /**
     * Global Instance for singleton access.
     */
    static getInstance() {
        if (!this.instance) this.instance = new TelemetryEngine();
        return this.instance;
    }
}

module.exports = TelemetryEngine.getInstance();
