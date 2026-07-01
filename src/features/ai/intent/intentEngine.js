/**
 * IntentEngine Module (Architectural Version 3.0)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Domain, and Behavioral Logic.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');
const VectorService = require('../knowledge/vectorService');

class IntentEngine {
    /**
     * The Master Contract for all downstream modules.
     */
    static _createContract(data = {}) {
        return {
            originalQuery: data.originalQuery || "",
            refinedQuery: data.refinedQuery || "",
            normalizedIntent: data.normalizedIntent || "GENERAL_QUERY",
            rawIntent: data.rawIntent || "NONE",
            domain: data.domain || "GENERAL",
            behavior: data.behavior || "RESPOND",
            mode: data.mode || "GENERAL_HELP",
            confidence: data.confidence || 0.0,
            entities: data.entities || { job: null, location: null, category: null },
            isFollowUp: !!data.isFollowUp,
            reasoningShort: data.reasoningShort || "Fallback logic used"
        };
    }

    static async classify(query, state = {}, profile = {}) {
        // 1. NEURAL REFINEMENT (Preserves original signal)
        const refinerResult = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // 2. COGNITIVE ANALYSIS (Motive & Entities)
        const analysis = await LLMDetector.classify(refinerResult.refinedQuery, {
            topic: state.currentTopic || state.topic,
            profileStr: JSON.stringify(profile)
        });

        if (!analysis) return this._createContract({ ...refinerResult });

        // 3. MASTER NORMALIZATION (Centralized logic - no re-mapping in Planner)
        const { normalizedIntent, mode, behavior } = this._resolveSystemValues(analysis, refinerResult.refinedQuery);

        return this._createContract({
            ...refinerResult,
            rawIntent: analysis.primaryIntent,
            normalizedIntent,
            domain: analysis.domain || "GENERAL",
            behavior: analysis.behavior || behavior,
            mode,
            confidence: analysis.confidence || 0.5,
            entities: analysis.entities || {},
            reasoningShort: analysis.thought_process || analysis.reasoning || "Neural classification"
        });
    }

    /**
     * Maps Motives (Human) to System Constants (Technical)
     */
    static _resolveSystemValues(analysis, query) {
        const raw = String(analysis.primaryIntent || '').toUpperCase();
        const lowQuery = query.toLowerCase();

        // Default Values
        let normalizedIntent = "GENERAL_QUERY";
        let mode = "GENERAL_HELP";
        let behavior = "RESPOND";

        // Logic Mapping
        if (raw === 'TRANSACTIONAL' || raw === 'JOB_SEARCH') {
            normalizedIntent = "JOB_SEARCH";
            mode = "JOB_SEARCH";
        }
        else if (raw === 'FACTUAL' || raw === 'FIELD_DETAILS' || raw === 'FIELD_CHECK') {
            normalizedIntent = "FIELD_DETAILS";
            mode = "JOB_DETAILS";
        }
        else if (raw === 'DISCOVERY') {
            normalizedIntent = "DISCOVERY";
            mode = "JOB_SEARCH";
        }
        else if (raw === 'GUIDANCE' || raw === 'CAREER_GUIDANCE') {
            normalizedIntent = "CAREER_GUIDANCE";
            mode = "CAREER_GUIDANCE";
        }
        else if (raw === 'PERSISTENCE' || raw === 'PROFILE_INQUIRY') {
            normalizedIntent = "PROFILE_INQUIRY";
            mode = "PROFILE_CHECK";
        }
        else if (raw === 'ADMINISTRATIVE' || raw === 'RESULT_ADMIT_CARD') {
            normalizedIntent = "RESULT_ADMIT_CARD";
            mode = "JOB_DETAILS";
        }
        else if (raw === 'RESUME') { normalizedIntent = "RESUME"; mode = "CAREER_GUIDANCE"; }
        else if (raw === 'INTERVIEW') { normalizedIntent = "INTERVIEW"; mode = "CAREER_GUIDANCE"; }
        else if (raw === 'SCHOLARSHIP') { normalizedIntent = "SCHOLARSHIP"; mode = "JOB_SEARCH"; }
        else if (raw === 'SKILLS') { normalizedIntent = "SKILLS"; mode = "CAREER_GUIDANCE"; }
        else if (raw === 'GREETING' || raw === 'RAPPORT') {
            normalizedIntent = "GREETING";
            mode = "GENERAL_HELP";
            behavior = "GREET";
        }

        // Emergency Overrides based on query semantic (Anti-Hallucination)
        if (lowQuery.includes('fees') || lowQuery.includes('salary')) {
            normalizedIntent = "FIELD_DETAILS";
            mode = "JOB_DETAILS";
        }

        return { normalizedIntent, mode, behavior };
    }
}

module.exports = IntentEngine;
