/**
 * ExecutionEngine Module (Architectural Version 5.0)
 * Responsibility: Production-grade workflow executor.
 * Handles dependency graphs, parallel/sequential execution, retries, and metrics.
 */
const ToolRegistry = require('./toolRegistry');

class ExecutionEngine {
    /**
     * Executes an Action Plan from the Cognitive Controller.
     */
    static async executePlan(plan, context = {}) {
        const startTime = Date.now();
        const results = {
            success: true,
            outputs: {},
            metrics: {
                latency: 0,
                retries: 0,
                stepsExecuted: 0
            },
            errors: []
        };

        try {
            // 1. Group steps by execution order (dependency layers)
            // If parallel=true, we treat all non-LLM steps as one layer
            const layers = this._buildExecutionLayers(plan);

            for (const layer of layers) {
                const layerResults = await Promise.allSettled(
                    layer.map(step => this._executeStepWithRetry(step, context, results.metrics))
                );

                // Collect outputs and handle failures
                layerResults.forEach((res, index) => {
                    const step = layer[index];
                    const toolName = step.tool.toLowerCase();

                    if (res.status === 'fulfilled') {
                        results.outputs[toolName] = res.value;
                        results.metrics.stepsExecuted++;
                    } else {
                        results.errors.push({ tool: step.tool, error: res.reason.message, critical: step.critical !== false });
                        // If a critical tool fails, we mark success as false but continue where possible
                        if (step.critical !== false) results.success = false;
                    }
                });

                // If a critical layer failed, we might want to stop early
                if (!results.success && plan.stopOnFailure) break;
            }
        } catch (error) {
            results.success = false;
            results.errors.push({ system: error.message });
        } finally {
            results.metrics.latency = Date.now() - startTime;
        }

        return results;
    }

    /**
     * Groups steps into executable batches based on their step number or parallel flag.
     */
    static _buildExecutionLayers(plan) {
        if (!plan.execution || !Array.isArray(plan.execution)) return [];

        if (plan.parallel) {
            // In parallel mode, all steps except the final synthesis (usually LLM) can run together
            const asyncSteps = plan.execution.filter(s => s.tool !== 'LLM');
            const syncSteps = plan.execution.filter(s => s.tool === 'LLM');
            return [asyncSteps, syncSteps].filter(l => l.length > 0);
        }

        // Sequential mode: Group by step number
        const groups = {};
        plan.execution.forEach(step => {
            const s = step.step || 1;
            if (!groups[s]) groups[s] = [];
            groups[s].push(step);
        });

        return Object.keys(groups).sort((a, b) => a - b).map(key => groups[key]);
    }

    /**
     * Internal retry wrapper for tool execution.
     */
    static async _executeStepWithRetry(step, context, metrics, attempt = 0) {
        const tool = ToolRegistry.getTool(step.tool);
        const retryLimit = tool ? (tool.retryLimit || 0) : 0;

        try {
            // Map plan input or use default from context
            const input = step.input || context.userMessage;
            const timeoutMs = step.timeout || tool?.timeout || 10_000;
            return await this._withTimeout(
                ToolRegistry.execute(step.tool, input, context),
                timeoutMs,
                `${step.tool} timed out after ${timeoutMs}ms`
            );
        } catch (error) {
            if (attempt < retryLimit) {
                metrics.retries++;
                const delay = Math.pow(2, attempt) * 100; // Exponential backoff
                await new Promise(r => setTimeout(r, delay));
                return await this._executeStepWithRetry(step, context, metrics, attempt + 1);
            }
            if (step.critical === false || tool?.safeFallback) {
                return this._safeFallback(step.tool, tool);
            }
            throw error;
        }
    }

    static _withTimeout(promise, timeoutMs, message) {
        let timeoutId;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
        });

        return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
    }

    static _safeFallback(toolName, tool) {
        if (typeof tool?.safeFallback === 'function') return tool.safeFallback();
        const name = String(toolName || "").toUpperCase();
        if (name === 'RAG') return { jobs: "", documents: [], confidence: 0 };
        if (name === 'MEMORY') return { facts: [], recentHistory: [] };
        if (name === 'PROFILE') return {};
        if (name === 'CALCULATOR') return { result: "" };
        return {};
    }
}

module.exports = ExecutionEngine;
