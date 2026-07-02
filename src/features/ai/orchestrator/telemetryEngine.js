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
            return s ? `${s.duration} ms` : 'SKIPPED';
        };

        const getVal = (mod) => {
            const s = trace.stages.find(s => s.module === mod);
            return s ? s.duration || 0 : 0;
        };

        const total = trace.totalDuration;

        console.log('\n--- PERFORMANCE TELEMETRY ---');
        const telemetryRows = [
            ['Gateway', 'GATEWAY_VALIDATION'],
            ['Planner', 'QUERY_UNDERSTANDING_ENGINE'],
            ['Memory Engine', 'CONTEXT_LOADING'],
            ['Search Engine', 'SEARCH_ENGINE'], // Assuming tracked separately if possible
            ['Database Engine', 'DATABASE_ENGINE'], // Assuming tracked separately if possible
            ['Ranking Engine', 'RANKING_ENGINE'], // Assuming tracked separately if possible
            ['Execution Engine', 'EXECUTION_ENGINE'],
            ['Prompt Composer', 'PROMPT_BUILDER'],
            ['Main LLM TTFT', 'LLM_TTFT'],
            ['LLM Generation', 'FINAL_LLM'],
            ['Post Processing', 'SAFETY_GUARDRAILS'],
            ['Memory Update', 'BACKGROUND_SERVICES']
        ];

        telemetryRows.forEach(([label, mod]) => {
            const val = getDur(mod);
            console.log(`${label.padEnd(22, '.')} ${val}`);
        });
        console.log(`${'TOTAL'.padEnd(22, '.')} ${total} ms`);

        // Bottleneck Analysis
        const durations = telemetryRows.map(([label, mod]) => ({ label, dur: getVal(mod) }));
        const max = durations.reduce((prev, curr) => (prev.dur > curr.dur) ? prev : curr, { label: 'N/A', dur: 0 });
        const pct = total > 0 ? ((max.dur / total) * 100).toFixed(0) : 0;

        if (max.dur > 0) {
            console.log('\nBottleneck :');
            console.log(max.label);
            console.log(`${max.dur} ms`);
            console.log(`${pct}% of total latency`);
        }

        // Pipeline Health
        console.log('\nPipeline Health');
        const healthCheck = [
            ['Planner', 'QUERY_UNDERSTANDING_ENGINE'],
            ['Memory', 'CONTEXT_LOADING'],
            ['Search', 'SEARCH_ENGINE'],
            ['Database', 'DATABASE_ENGINE'],
            ['Ranking', 'RANKING_ENGINE'],
            ['Prompt Composer', 'PROMPT_BUILDER'],
            ['LLM', 'FINAL_LLM'],
            ['Memory Update', 'BACKGROUND_SERVICES']
        ];

        healthCheck.forEach(([label, mod]) => {
            const s = trace.stages.find(s => s.module === mod);
            let status = '—';
            if (s) {
                status = s.status === 'SUCCESS' ? '✓' : (s.status === 'FAILED' ? '✗' : '—');
            }
            console.log(`${label.padEnd(16)} ${status}`);
        });
        console.log('------------------------------\n');
    }

    static getInstance() {
        if (!this.instance) this.instance = new TelemetryEngine();
        return this.instance;
    }
}

module.exports = TelemetryEngine.getInstance();
