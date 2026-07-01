/**
 * AIOrchestrator Module (Architectural Version 13.0 - Neural Pipeline)
 * Follows the Cognitive Architecture strictly:
 * Gateway -> Controller -> Execution -> Retrieval -> Prompt -> Final LLM -> Validation -> Stream
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
const SmartGateway = require('../quality/smartGateway');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');
const StreamingEngine = require('./streamingEngine');
const Telemetry = require('./telemetryEngine');
const BackgroundServices = require('./backgroundServices');
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
            // 1. API GATEWAY STAGE (SmartGateway)
            const gatewayStatus = await Telemetry.trackStage(traceId, 'GATEWAY_VALIDATION',
                () => SmartGateway.validate(userMessage)
            );
            if (gatewayStatus.status === 'BLOCK') {
                return { ...shapeResponse(SAFE_RESPONSES[gatewayStatus.reason || 'UNSAFE_OUTPUT']), requestId: traceId };
            }

            // 2. CONTEXT LOADING
            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            // 3. COGNITIVE CONTROLLER (Intent, Planning, Rewrite)
            const plan = await Telemetry.trackStage(traceId, 'COGNITIVE_CONTROLLER',
                () => IntentEngine.classify(userMessage, state, profile)
            );

            // 4. EXECUTION ENGINE & RETRIEVAL LAYER
            const execResult = await Telemetry.trackStage(traceId, 'EXECUTION_ENGINE',
                () => ExecutionEngine.executePlan(plan, { userMessage, profile, state, sessionId, plan })
            );

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            // 5. PROMPT BUILDER
            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: new Date().toLocaleDateString() })
            );

            // 6. FINAL LLM (Synthesis)
            const aiResponse = await Telemetry.trackStage(traceId, 'FINAL_LLM',
                () => LLMProvider.chat([
                    { role: 'system', content: promptData.systemPrompt },
                    { role: 'user', content: userMessage }
                ])
            );

            let finalContent = aiResponse.content;

            // 7. VALIDATION ENGINE
            const outputStatus = await Telemetry.trackStage(traceId, 'VALIDATION_ENGINE',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData)
            );
            if (outputStatus.status === 'REPLACE') finalContent = outputStatus.content;

            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            // FIRE BACKGROUND SERVICES
            BackgroundServices.runAll({
                traceId, userName, userMessage, finalContent: formatted,
                plan, execResult, suggestions
            });

            return { ...shapeResponse(formatted, { suggestions }), requestId: traceId };

        } catch (error) {
            console.error("❌ Neural Pipeline Error:", error);
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
            // 1. API GATEWAY STAGE
            const gatewayStatus = await SmartGateway.validate(userMessage);
            if (gatewayStatus.status === 'BLOCK') {
                stream.error(new Error(gatewayStatus.reason));
                return;
            }

            // 2. CONTEXT LOADING
            const [state, profile] = await Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)]);

            // 3. COGNITIVE CONTROLLER
            stream.startThinking('Sawal samajh raha hoon...');
            const plan = await IntentEngine.classify(userMessage, state, profile);

            // FAST PATH: Greetings skip execution
            if (plan.intent === 'GREETING') {
                await this._handleGreeting(userMessage, profile, stream);
                this._persist(userName, sessionId, userMessage, "Namaste! Jobo AI yahan hai.", {}).catch(() => {});
                BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: "Namaste! Jobo AI yahan hai.", plan });
                return;
            }

            // 4. EXECUTION ENGINE
            stream.startThinking('Data fetch ho raha hai...');
            const execResult = await ExecutionEngine.executePlan(plan, { userMessage, profile, state, sessionId, plan });
            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            // 5. PROMPT BUILDER
            const promptData = await PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: new Date().toLocaleDateString() });

            // 6. FINAL LLM (Streaming)
            stream.startThinking('Jawab likh raha hoon...');
            let fullContent = "";
            let isInsideUserMessage = false;

            await LLMProvider.chatStream([
                { role: 'system', content: promptData.systemPrompt },
                { role: 'user', content: userMessage }
            ], async (chunk) => {
                fullContent += chunk;
                // Neural Tag Filtering
                if (fullContent.includes('<USER_MESSAGE>')) {
                    if (!isInsideUserMessage) {
                        isInsideUserMessage = true;
                        const parts = fullContent.split('<USER_MESSAGE>');
                        const part = parts[parts.length - 1];
                        if (part) await stream.pushChunk(part);
                    } else {
                        if (chunk.includes('</USER_MESSAGE>')) {
                            const lastPart = chunk.split('</USER_MESSAGE>')[0];
                            await stream.pushChunk(lastPart);
                            isInsideUserMessage = false;
                        } else {
                            await stream.pushChunk(chunk);
                        }
                    }
                } else if (fullContent.length > 400) {
                    await stream.pushChunk(chunk); // Fallback if tags missing
                }
            });

            // 8. STREAMING ENGINE FINISH
            const match = fullContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
            const finalContent = (match ? match[1] : fullContent).replace(/<\/?USER_MESSAGE>/gi, '').trim();

            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, finalContent, suggestions);

            // FIRE BACKGROUND SERVICES
            BackgroundServices.runAll({
                traceId, userName, userMessage, finalContent,
                plan, execResult, suggestions
            });

            await stream.finishStream({ suggestions });

        } catch (error) {
            console.error("❌ Stream Pipeline Error:", error);
            stream.error(error);
        }
    }

    static async _handleGreeting(userMessage, profile, stream) {
        const promptData = await PromptComposer.build(['GREETING'], profile, {}, { plan: { intent: 'GREETING' }, currentDate: new Date().toLocaleDateString() });
        await LLMProvider.chatStream([
            { role: 'system', content: promptData.systemPrompt },
            { role: 'user', content: userMessage }
        ], async (chunk) => { await stream.pushChunk(chunk); });
        await stream.finishStream();
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
