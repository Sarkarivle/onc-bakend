/**
 * IntentEngine Module (Architectural Version 3.0)
 * Responsibility: SINGLE SOURCE OF TRUTH for Intent, Domain, and Behavioral Logic.
 * This version includes a hybrid approach with a deterministic guard layer and a semantic LLM detector.
 */
const NeuralRefiner = require('./normalizers/neuralRefiner');
const LLMDetector = require('./detectors/llmDetector');
const VectorService = require('../knowledge/vectorService');
const DeterministicIntentResolver = require('./DeterministicIntentResolver');

class IntentEngine {
    /**
     * The Master Contract for all downstream modules.
     */
    static _createContract(data = {}) {
        return {
            originalQuery: data.originalQuery || data.query || "",
            refinedQuery: data.refinedQuery || data.query || "",
            rawIntent: data.rawIntent || data.normalizedIntent || "NONE",
            normalizedIntent: data.normalizedIntent || "GENERAL_QUERY",
            intent: data.normalizedIntent || "GENERAL_QUERY", // Backward compatibility alias
            domain: data.domain || "GENERAL",
            behavior: data.behavior || "RESPOND", // Default behavior
            mode: data.mode || "GENERAL_HELP", // Default mode
            confidence: data.confidence !== undefined ? data.confidence : 0.1,
            slots: data.slots || data.entities || {},
            entities: data.slots || data.entities || {}, // Backward compatibility alias
            needsClarification: data.needsClarification || data.behavior === 'CLARIFY',
            isFollowUp: !!data.isFollowUp, // Ensure boolean
            reasoningShort: data.reasoningShort || "Contract fallback logic"
        };
    }

    static async classify(query, state = {}, profile = {}) {
        // 0. Deterministic Guard Layer (for greetings, safety, simple commands)
        const deterministicResult = DeterministicIntentResolver.resolve(query);
        if (deterministicResult) {
            const { normalizedIntent, mode, behavior } = this._resolveSystemValues(deterministicResult, query);
            const finalContract = this._createContract({
                ...deterministicResult,
                normalizedIntent,
                mode,
                behavior
            });
            return finalContract;
        }

        // 1. NEURAL REFINEMENT (Preserves original signal)
        const refinerResult = await NeuralRefiner.refine(query, {
            topic: state.currentTopic || state.topic,
            turnCount: state.turnCount
        });

        // Determine the primary query signal based on refiner risk assessment
        const primaryQuerySignal = refinerResult.refinerChangedMeaningRisk
            ? refinerResult.originalQuery
            : refinerResult.refinedQuery;

        // 2. COGNITIVE ANALYSIS (Motive & Entities)
        const analysis = await LLMDetector.classify(primaryQuerySignal, {
            topic: state.currentTopic || state.topic,
            profileStr: JSON.stringify(profile),
            isHighRiskRefinement: !!refinerResult.refinerChangedMeaningRisk
        });

        // If LLM analysis fails, create a default contract but still resolve system values
        const baseAnalysis = analysis || { primaryIntent: 'FALLBACK' };

        // 3. MASTER NORMALIZATION (Centralized logic - no re-mapping in Planner)
        const { normalizedIntent, mode, behavior } = this._resolveSystemValues(baseAnalysis, refinerResult.refinedQuery);

        const finalContract = this._createContract({
            ...refinerResult,
            rawIntent: baseAnalysis.primaryIntent,
            normalizedIntent,
            domain: baseAnalysis.domain || "GENERAL",
            behavior: behavior, // Always use the system-resolved behavior for consistency
            mode,
            confidence: baseAnalysis.confidence || 0.5,
            entities: baseAnalysis.entities || {},
            reasoningShort: baseAnalysis.thought_process || baseAnalysis.reasoning || (analysis ? "Neural classification" : "LLM detector fallback")
        });

        if (process.env.DEBUG_AI_PIPELINE === 'true') {
            console.log('[AI DEBUG] IntentEngine Output:', {
                originalQuery: finalContract.originalQuery,
                refinedQuery: finalContract.refinedQuery,
                ...finalContract,
                source: finalContract.reasoningShort,
                refinerRisk: refinerResult.refinerChangedMeaningRisk
            });
        }
        return finalContract;
    }

    /**
     * Maps Motives (Human) to System Constants (Technical)
     */
    static _resolveSystemValues(analysis, query) {
        const raw = String(analysis.primaryIntent || '').toUpperCase();
        const lowQuery = query.toLowerCase();
        const isClarify = analysis.needsClarification === true;

        // Default Values
        let normalizedIntent = "GENERAL_QUERY";
        let mode = "GENERAL_HELP";
        let behavior = "RESPOND";

        // Logic Mapping
        if (isClarify) {
            behavior = "CLARIFY";
            normalizedIntent = analysis.primaryIntent || "AMBIGUOUS_QUERY";
        }
        else if (raw === 'SAFETY_VIOLATION' || raw === 'GARBAGE') {
            behavior = "BLOCK";
            normalizedIntent = raw;
        }
        else if (raw === 'ACKNOWLEDGEMENT') {
            behavior = "OK_RESPONSE";
            normalizedIntent = raw;
        }
        else if (raw === 'AMBIGUOUS_QUERY') {
            behavior = "CLARIFY";
            normalizedIntent = raw;
        }
        else if (raw === 'GREETING' || raw === 'RAPPORT') {
            normalizedIntent = "GREETING";
            mode = "GENERAL_HELP";
            behavior = "GREET";
        }
        else if (raw === 'IDENTITY') {
            normalizedIntent = "IDENTITY";
            mode = "GENERAL_HELP";
        }
        else if (raw === 'TRANSACTIONAL' || raw === 'JOB_SEARCH') {
            normalizedIntent = "JOB_SEARCH";
            mode = "JOB_SEARCH";
        } else if (raw === 'FACTUAL' || raw === 'FIELD_DETAILS' || raw === 'FIELD_CHECK') {
            normalizedIntent = "FIELD_DETAILS";
            mode = "JOB_DETAILS";
        } else if (raw === 'DISCOVERY') {
            normalizedIntent = "DISCOVERY";
            mode = "JOB_SEARCH";
        } else if (raw === 'GUIDANCE' || raw === 'CAREER_GUIDANCE') {
            normalizedIntent = "CAREER_GUIDANCE";
            mode = "CAREER_GUIDANCE";
        } else if (raw === 'PERSISTENCE' || raw === 'PROFILE_INQUIRY') {
            normalizedIntent = "PROFILE_INQUIRY";
            mode = "PROFILE_CHECK";
        } else if (raw === 'ADMINISTRATIVE' || raw === 'RESULT_ADMIT_CARD') {
            normalizedIntent = "RESULT_ADMIT_CARD";
            mode = "JOB_DETAILS";
        } else if (raw === 'RESUME' || raw === 'INTERVIEW' || raw === 'SKILLS' || raw === 'COLLEGE') {
            normalizedIntent = raw;
            mode = "CAREER_GUIDANCE";
        } else if (raw === 'SCHOLARSHIP') {
            normalizedIntent = "SCHOLARSHIP";
            mode = "JOB_SEARCH";
        } else if (raw === 'MOTIVATION') {
            normalizedIntent = "MOTIVATION";
            mode = "GENERAL_HELP";
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
