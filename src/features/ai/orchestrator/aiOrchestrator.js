/**
 * AIOrchestrator Module (Architectural Version 12.0 - Learning Loop Integrated)
 */
const Chat = require('../../chat/chatModel');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const IntentEngine = require('../intent/intentEngine');
const ExecutionEngine = require('./executionEngine');
const MemoryEngine = require('../memory/memoryEngine');
const PromptComposer = require('../generation/promptComposer');
const LLMProvider = require('../generation/llmProvider');
const ValidationEngine = require('../quality/validationEngine');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');
const Telemetry = require('./telemetryEngine');
const LearningEngine = require('../learning/learningEngine'); // New Learning Engine
const { shapeResponse, SAFE_RESPONSES, normalizeRequest } = require('../quality/safetyGuard');

class AIOrchestrator {
    static async processRequest(input) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage);

        try {
            // STAGE 1: INPUT VALIDATION
            const inputStatus = await Telemetry.trackStage(traceId, 'INPUT_VALIDATION',
                () => ValidationEngine.validateInput(userMessage)
            );

            if (inputStatus.status === 'BLOCK') {
                const finalTrace = Telemetry.endTrace(traceId);
                LearningEngine.processTrace(finalTrace).catch(console.error);
                return { ...shapeResponse(SAFE_RESPONSES[inputStatus.reason]), requestId: traceId };
            }

            // STAGE 2: CONTEXT LOADING
            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            // STAGE 3: COGNITIVE PLANNING
            const plan = await Telemetry.trackStage(traceId, 'UCC_PLANNING',
                () => IntentEngine.classify(userMessage, state, profile)
            );
            Telemetry.logEvent(traceId, 'UCC_PLANNING', { intent: plan.intent, parallel: plan.parallel, plan });

            // STAGE 4: EXECUTION ENGINE
            const execResult = await Telemetry.trackStage(traceId, 'TOOL_EXECUTION',
                () => ExecutionEngine.executePlan(plan, { userMessage, profile, state, sessionId, plan })
            );
            Telemetry.logEvent(traceId, 'TOOL_EXECUTION', {
                latency: execResult.metrics.latency,
                success: execResult.success,
                toolsUsed: Object.keys(execResult.outputs),
                resultsCount: execResult.outputs.rag?.count || 0
            });

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            // STAGE 5: PROMPT COMPOSITION
            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build(
                    [plan.intent],
                    { ...profile, history: liveData.memory.recentHistory, insights: liveData.memory.facts },
                    liveData,
                    { sessionId, turnCount: state.turnCount, behavior: plan.behavior, plan, currentDate: new Date().toLocaleDateString() }
                )
            );
            Telemetry.logEvent(traceId, 'PROMPT_BUILDER', { tokenEstimate: promptData.tokenEstimate });

            // STAGE 6: LLM SYNTHESIS
            const aiResponse = await Telemetry.trackStage(traceId, 'LLM_SYNTHESIS',
                () => LLMProvider.chat([
                    { role: 'system', content: promptData.systemPrompt },
                    { role: 'user', content: userMessage }
                ])
            );
            Telemetry.logEvent(traceId, 'LLM_SYNTHESIS', { finishReason: aiResponse.finishReason });

            let finalContent = aiResponse.content;
            if (finalContent.includes('<USER_MESSAGE>')) {
                finalContent = (finalContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i) || [null, finalContent])[1].trim();
            }

            // STAGE 7: OUTPUT VALIDATION
            const outputStatus = await Telemetry.trackStage(traceId, 'OUTPUT_VALIDATION',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData)
            );
            if (outputStatus.status === 'REPLACE') {
                finalContent = outputStatus.content;
                Telemetry.logEvent(traceId, 'OUTPUT_VALIDATION', { autoCorrected: true, reason: outputStatus.reason });
            }

            // STAGE 8: PERSISTENCE & UX
            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            // FINAL: END TRACE & TRIGGER LEARNING
            const finalTrace = Telemetry.endTrace(traceId);
            // ASYNC LEARNING LOOP (Does not block user response)
            LearningEngine.processTrace(finalTrace).catch(console.error);

            return { ...shapeResponse(formatted, { suggestions }), requestId: traceId };

        } catch (error) {
            console.error("❌ Observed Pipeline Error:", error);
            Telemetry.logEvent(traceId, 'FATAL_ERROR', { error: error.message });
            const finalTrace = Telemetry.endTrace(traceId);
            LearningEngine.processTrace(finalTrace).catch(console.error);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId: traceId };
        }
    }

    static async _persist(userName, sessionId, query, response, suggestions) {
        try {
            const name = userName || "User";
            await Chat.create({ userName: name, sessionId, role: 'user', content: query });
            await Chat.create({ userName: name, sessionId, role: 'assistant', content: response, suggestions });
        } catch (e) { console.error("❌ Persistence Error:", e.message); }
    }
}

module.exports = AIOrchestrator;
