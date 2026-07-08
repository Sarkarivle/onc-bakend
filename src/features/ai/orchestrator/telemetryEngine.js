/**
 * TelemetryEngine Module (Architectural Version 13.0)
 * Responsibility: Enterprise-grade observability, tracing, and bottleneck analysis.
 */
const { randomUUID } = require('crypto');

class TelemetryEngine {
    constructor() {
        this.traces = new Map();
    }

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

    logStageManual(traceId, moduleName, duration, status = 'SUCCESS') {
        const trace = this.traces.get(traceId);
        if (!trace) return;
        trace.stages.push({
            module: moduleName,
            duration,
            status,
            startTime: Date.now() - duration,
            endTime: Date.now()
        });
    }

    setContext(traceId, metadata = {}) {
        const trace = this.traces.get(traceId);
        if (!trace) return;
        trace.context = { ...trace.context, ...metadata };
    }

    endTrace(traceId) {
        const trace = this.traces.get(traceId);
        if (!trace) return null;

        trace.endTime = Date.now();
        trace.totalDuration = trace.endTime - trace.startTime;

        this._printModernReport(trace);

        // Cleanup
        this.traces.delete(traceId);
        return trace;
    }

    _printModernReport(trace) {
        const getDur = (mod) => {
            const s = trace.stages.find(s => s.module === mod);
            return s ? `${s.duration} ms` : null;
        };

        const total = trace.totalDuration;

        console.log('\n--- PERFORMANCE TELEMETRY ---');
        const telemetryRows = [
            ['Gateway', 'GATEWAY_VALIDATION'],
            ['Context Engine', 'CONTEXT_LOADING'],
            ['Agentic Loop', 'AGENTIC_LOOP'],
            ['Background Services', 'BACKGROUND_SERVICES']
        ];

        telemetryRows.forEach(([label, mod]) => {
            const val = getDur(mod);
            if (val) console.log(`${label.padEnd(22, '.')} ${val}`);
        });
        console.log(`${'TOTAL'.padEnd(22, '.')} ${total} ms`);

        // Pipeline Health
        console.log('\nPipeline Health');
        telemetryRows.forEach(([label, mod]) => {
            const s = trace.stages.find(s => s.module === mod);
            let status = '—';
            if (s) {
                status = s.status === 'SUCCESS' ? '✓' : (s.status === 'FAILED' ? '✗' : '—');
            }
            console.log(`${label.padEnd(20)} ${status}`);
        });
        console.log('------------------------------\n');
    }

    static getInstance() {
        if (!this.instance) this.instance = new TelemetryEngine();
        return this.instance;
    }
}

module.exports = TelemetryEngine.getInstance();
