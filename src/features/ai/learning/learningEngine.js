/**
 * LearningEngine Module (Architectural Version 12.0)
 * Responsibility: Continuous improvement through telemetry analysis and pattern discovery.
 * Designed for Human-in-the-loop optimization of the AI system.
 */
const mongoose = require('mongoose');

// Schema for storing optimization insights and failure patterns
const insightSchema = new mongoose.Schema({
    traceId: { type: String, required: true, unique: true },
    timestamp: { type: Date, default: Date.now },
    qualityScore: { type: Number }, // 0 to 1
    failureCategory: { type: String }, // e.g., 'INTENT_MISMATCH', 'HALLUCINATION'
    rootCause: { type: String },
    recommendation: { type: String },
    metrics: {
        latency: Number,
        tokens: Number,
        retries: Number
    },
    intent: String,
    plannerPlan: Object,
    isAbTest: { type: Boolean, default: false },
    testGroup: String
});

const Insight = mongoose.model('OptimizationInsight', insightSchema);

class LearningEngine {
    /**
     * Entry Point: Analyzes a completed trace for optimization signals.
     */
    static async processTrace(trace) {
        try {
            if (Insight.db?.readyState !== 1) return;
            const analysis = await this._analyze(trace);

            await Insight.create({
                traceId: trace.traceId,
                qualityScore: analysis.score,
                failureCategory: analysis.failureCategory,
                rootCause: analysis.rootCause,
                recommendation: analysis.recommendation,
                metrics: {
                    latency: trace.totalDuration || 0,
                    tokens: trace.metrics?.totalTokens || 0,
                    retries: trace.metrics?.retries || 0
                },
                intent: this._getStageMetadata(trace, 'QUERY_UNDERSTANDING_ENGINE', 'intent') || trace.intent,
                plannerPlan: this._getStageMetadata(trace, 'PLANNER_ENGINE', 'plan')
            });

            // If a severe failure is detected, trigger an immediate internal alert
            if (analysis.score < 0.4) {
                this._triggerOptimizationAlert(analysis);
            }

        } catch (error) {
            console.error("❌ Learning Engine Analysis Error:", error.message);
        }
    }

    /**
     * Core Analysis Logic (Heuristics + AI-based scoring)
     */
    static async _analyze(trace) {
        let score = 1.0;
        let failureCategory = 'NONE';
        let rootCause = '';
        let recommendation = '';

        if (!trace.stages) return { score, failureCategory, rootCause, recommendation };

        const ucc = trace.stages.find(s => s.module === 'PLANNER_ENGINE' || s.module === 'QUERY_UNDERSTANDING_ENGINE');
        const outputVal = trace.stages.find(s => s.module === 'SAFETY_GUARDRAILS' || s.module === 'VALIDATION_ENGINE');
        const exec = trace.stages.find(s => s.module === 'EXECUTION_ENGINE');

        // 1. Detect Hallucination (Highest Penalty)
        if (outputVal?.metadata?.autoCorrected) {
            score -= 0.5;
            failureCategory = 'HALLUCINATION';
            rootCause = `Output Validator flagged: ${outputVal.metadata.reason}`;
            recommendation = 'Improve RAG grounding instructions in PROMPT_BUILDER.';
        }

        // 2. Detect Planning Inefficiency
        if (exec?.metadata?.latency > 3000 && !ucc?.metadata?.parallel) {
            score -= 0.1;
            recommendation += ' Planner should consider PARALLEL execution for these tools.';
        }

        // 3. Detect Retrieval Failure
        if (exec?.metadata?.toolsUsed.includes('rag') && exec.metadata.resultsCount === 0) {
            score -= 0.2;
            failureCategory = 'RETRIEVAL_FAILURE';
            rootCause = 'RAG returned zero results for a search-intent query.';
            recommendation = 'Check Vector Index health or expand Query Expansion synonyms.';
        }

        // 4. Latency Penalty
        if (trace.totalDuration > 8000) {
            score -= 0.2;
            rootCause += ' | High Latency';
        }

        return {
            score: Math.max(0, score),
            failureCategory,
            rootCause,
            recommendation: recommendation.trim()
        };
    }

    static _getStageMetadata(trace, moduleName, key) {
        if (!trace || !trace.stages) return null;
        const stage = trace.stages.find(s => s.module === moduleName);
        return stage?.metadata ? stage.metadata[key] : null;
    }

    static _triggerOptimizationAlert(analysis) {
        // In production, this would send a message to Slack/Sentry/PagerDuty
        console.warn(`[LEARNING_ENGINE_ALERT] Low Quality detected: ${analysis.failureCategory}. RC: ${analysis.rootCause}`);
    }

    /**
     * Generates a summary report for the dashboard.
     */
    static async generateOptimizationReport() {
        if (Insight.db?.readyState !== 1) return [];
        const report = await Insight.aggregate([
            {
                $group: {
                    _id: "$failureCategory",
                    count: { $sum: 1 },
                    avgScore: { $avg: "$qualityScore" },
                    commonRecommendations: { $push: "$recommendation" }
                }
            },
            { $sort: { count: -1 } }
        ]);
        return report;
    }
}

module.exports = LearningEngine;
