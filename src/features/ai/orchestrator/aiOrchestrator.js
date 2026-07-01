/**
 * AIOrchestrator Module (Architectural Version 12.0 - Fully Observed & Stream-Compatible)
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
const StreamingEngine = require('./streamingEngine');
const Telemetry = require('./telemetryEngine');
const LearningEngine = require('../learning/learningEngine');
const { shapeResponse, SAFE_RESPONSES, normalizeRequest } = require('../quality/safetyGuard');

class AIOrchestrator {
    /**
     * Standard Synchronous Request
     */
    static async processRequest(input) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage);

        try {
            const inputStatus = await Telemetry.trackStage(traceId, 'INPUT_VALIDATION',
                () => ValidationEngine.validateInput(userMessage)
            );

            if (inputStatus.status === 'BLOCK') {
                Telemetry.endTrace(traceId);
                return { ...shapeResponse(SAFE_RESPONSES[inputStatus.reason]), requestId: traceId };
            }

            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            const plan = await Telemetry.trackStage(traceId, 'UCC_PLANNING',
                () => IntentEngine.classify(userMessage, state, profile)
            );
            Telemetry.logEvent(traceId, 'UCC_PLANNING', { intent: plan.intent, parallel: plan.parallel, plan });

            const execResult = await Telemetry.trackStage(traceId, 'TOOL_EXECUTION',
                () => ExecutionEngine.executePlan(plan, { userMessage, profile, state, sessionId, plan })
            );

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build(
                    [plan.intent],
                    { ...profile, history: liveData.memory.recentHistory, insights: liveData.memory.facts },
                    liveData,
                    { sessionId, turnCount: state.turnCount, behavior: plan.behavior, plan, currentDate: new Date().toLocaleDateString() }
                )
            );

            const aiResponse = await Telemetry.trackStage(traceId, 'LLM_SYNTHESIS',
                () => LLMProvider.chat([
                    { role: 'system', content: promptData.systemPrompt },
                    { role: 'user', content: userMessage }
                ])
            );

            let finalContent = aiResponse.content;
            if (finalContent.includes('<USER_MESSAGE>')) {
                finalContent = (finalContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i) || [null, finalContent])[1].trim();
            }

            const outputStatus = await Telemetry.trackStage(traceId, 'OUTPUT_VALIDATION',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData)
            );
            if (outputStatus.status === 'REPLACE') {
                finalContent = outputStatus.content;
            }

            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            const finalTrace = Telemetry.endTrace(traceId);
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

    /**
     * Production-Grade Streaming Request
     */
    static async processRequestStream(input, res) {
        const stream = new StreamingEngine(res);
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;

        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage);

        try {
            // STAGE 1: INPUT VALIDATION
            const inputStatus = await Telemetry.trackStage(traceId, 'INPUT_VALIDATION',
                () => ValidationEngine.validateInput(userMessage)
            );
            if (inputStatus.status === 'BLOCK') {
                stream.error(new Error(inputStatus.reason));
                Telemetry.endTrace(traceId);
                return;
            }

            // STAGE 2: CONTEXT LOADING
            stream.emit('stage', { stage: 'CONTEXT_LOADING', status: 'Context load ho raha hai...' });
            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            // STAGE 3: COGNITIVE PLANNING
            stream.emit('stage', { stage: 'UCC_PLANNING', status: 'Sawal samajh raha hoon...' });
            const plan = await Telemetry.trackStage(traceId, 'UCC_PLANNING',
                () => IntentEngine.classify(userMessage, state, profile)
            );

            // STAGE 4: EXECUTION ENGINE
            stream.emit('stage', { stage: 'TOOL_EXECUTION', status: 'Data fetch ho raha hai...' });
            const execResult = await Telemetry.trackStage(traceId, 'TOOL_EXECUTION',
                () => ExecutionEngine.executePlan(plan, { userMessage, profile, state, sessionId, plan })
            );

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

            // STAGE 6: LLM SYNTHESIS (Streaming)
            stream.emit('stage', { stage: 'LLM_THINKING', status: 'Jawab likh raha hoon...' });
            let fullContent = "";
            let isInsideUserMessage = false;
            let hasSeenTags = false;

            await LLMProvider.chatStream([
                { role: 'system', content: promptData.systemPrompt },
                { role: 'user', content: userMessage }
            ], async (chunk) => {
                fullContent += chunk;

                if (fullContent.includes('<USER_MESSAGE>')) {
                    hasSeenTags = true;
                    if (!isInsideUserMessage) {
                        isInsideUserMessage = true;
                        const parts = fullContent.split('<USER_MESSAGE>');
                        const firstPart = parts[parts.length - 1];
                        if (firstPart) await stream.pushChunk(firstPart);
                    } else {
                        await stream.pushChunk(chunk);
                    }
                } else if (!hasSeenTags && fullContent.length > 200) {
                    // Fallback: If no tags after 200 chars, just stream everything
                    await stream.pushChunk(chunk);
                } else if (isInsideUserMessage) {
                    if (chunk.includes('</USER_MESSAGE>')) {
                        const finalPart = chunk.split('</USER_MESSAGE>')[0];
                        await stream.pushChunk(finalPart);
                        isInsideUserMessage = false;
                    } else {
                        await stream.pushChunk(chunk);
                    }
                }
            });

            // FINAL STAGES: CLEANUP & PERSISTENCE
            const match = fullContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
            let finalContent = match ? match[1].trim() : fullContent;
            finalContent = finalContent.replace(/<\/?USER_MESSAGE>/gi, '').trim();

            // If nothing was pushed yet (e.g. no tags and short message), push it now
            if (stream.metrics.tokenCount === 0 && finalContent) {
                await stream.pushChunk(finalContent);
            }

            MemoryEngine.extractFacts(userName || "User", userMessage, finalContent).catch(console.error);
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, finalContent, suggestions);

            // Send metadata in the last chunk for Flutter parser
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions })}`;
            await stream.pushChunk(metadataStr);

            await stream.finishStream();
            Telemetry.endTrace(traceId);

        } catch (error) {
            console.error("❌ Stream Observed Error:", error);
            stream.error(error);
            Telemetry.endTrace(traceId);
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
