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
            // 1. API GATEWAY STAGE
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

            // 3. COGNITIVE CONTROLLER
            const plan = await Telemetry.trackStage(traceId, 'COGNITIVE_CONTROLLER',
                () => IntentEngine.classify(userMessage, state, profile)
            );

            const fixedResponse = this._fixedSimpleResponse(plan.intent);
            if (fixedResponse) {
                const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: "" });
                await this._persist(userName, sessionId, userMessage, fixedResponse, suggestions);
                BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: fixedResponse, plan, execResult: null, suggestions });
                return { ...shapeResponse(fixedResponse, { suggestions }), requestId: traceId };
            }

            // 4. EXECUTION ENGINE
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
            const allowLlmValidation = !(plan.searchStrategy?.skipLlmExpansion && plan.searchStrategy?.skipLlmRerank);
            const outputStatus = await Telemetry.trackStage(traceId, 'VALIDATION_ENGINE',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData, { allowLlm: allowLlmValidation })
            );
            if (outputStatus.status === 'REPLACE') finalContent = outputStatus.content;

            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: formatted, plan, execResult, suggestions });

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
        const stream = new StreamingEngine(res, { bufferSize: 1 });
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

            // FAST PATH: Conversation starters and simple intents skip complex execution
            if (plan.needsPlanning === false && ['GREETING', 'IDENTITY', 'ACKNOWLEDGEMENT', 'PROFILE_QUERY'].includes(plan.intent)) {
                await this._handleFastResponse(userMessage, plan, profile, stream);
                BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: "Fast Response", plan });
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
            let hasExitedUserMessage = false;
            let hasPushedAnyContent = false;

            // Reinforce formatting in the user message to ensure model follows tags
            const reinforcedUserMessage = `${userMessage}\n\n(Note: Jawab Hinglish में दें और <USER_MESSAGE> टैग्स का इस्तेमाल करें)`;

            await LLMProvider.chatStream([
                { role: 'system', content: promptData.systemPrompt },
                { role: 'user', content: reinforcedUserMessage }
            ], async (chunk) => {
                fullContent += chunk;

                // Neural Tag Filtering & Clean Forwarding
                if (fullContent.includes('<USER_MESSAGE>') && !hasExitedUserMessage) {
                    if (!isInsideUserMessage) {
                        isInsideUserMessage = true;
                        const parts = fullContent.split('<USER_MESSAGE>');
                        const part = parts[parts.length - 1];
                        if (part) {
                            await stream.pushChunk(part);
                            hasPushedAnyContent = true;
                        }
                    } else {
                        if (chunk.includes('</USER_MESSAGE>')) {
                            const lastPart = chunk.split('</USER_MESSAGE>')[0];
                            if (lastPart) await stream.pushChunk(lastPart);
                            isInsideUserMessage = false;
                            hasExitedUserMessage = true;
                        } else {
                            await stream.pushChunk(chunk);
                            hasPushedAnyContent = true;
                        }
                    }
                } else if (!fullContent.includes('<AGENT_THOUGHT>') && (hasPushedAnyContent || fullContent.length > 150)) {
                    await stream.pushChunk(chunk); // Fallback for models not using tags
                    hasPushedAnyContent = true;
                }
            });

            // 8. FINALIZING & METADATA INJECTION (Crucial for Flutter)
            const match = fullContent.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
            const finalContent = (match ? match[1] : fullContent).replace(/<\/?USER_MESSAGE>/gi, '').trim();

            // If we never streamed during the loop (e.g. short response, no tags), stream it now
            if (!hasPushedAnyContent && finalContent) {
                await stream.pushChunk(finalContent);
            }

            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            // Send metadata in a format Flutter parser expects
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions })}`;
            await stream.pushChunk(metadataStr);

            await stream.finishStream();

            await this._persist(userName, sessionId, userMessage, finalContent, suggestions);
            BackgroundServices.runAll({ traceId, userName, userMessage, finalContent, plan, execResult, suggestions });

        } catch (error) {
            console.error("❌ Stream Pipeline Error:", error);
            stream.error(error);
        }
    }

    static async _handleFastResponse(userMessage, plan, profile, stream) {
        const fixedResponse = this._fixedSimpleResponse(plan.intent);
        if (fixedResponse) {
            await stream.pushChunk(fixedResponse);
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions: ["Latest jobs", "Career advice"] })}`;
            await stream.pushChunk(metadataStr);
            await stream.finishStream();
            return;
        }

        if (plan.intent === 'PROFILE_QUERY') {
            const response = `Bhai, aapki profile ke hisaab se: \n- Qualification: ${profile.qualification || 'Not set'}\n- Category: ${profile.category || 'General'}\n- State: ${profile.state || 'Not set'}\n\nKya aap ise update karna chahte hain?`;
            await stream.pushChunk(response);
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions: ["Update Profile", "Search Jobs for me"] })}`;
            await stream.pushChunk(metadataStr);
            await stream.finishStream();
            return;
        }

        const intent = plan.intent;
        const promptData = await PromptComposer.build([intent], profile, {}, { plan, currentDate: new Date().toLocaleDateString() });
        let hasPushed = false;

        await LLMProvider.chatStream([
            { role: 'system', content: promptData.systemPrompt },
            { role: 'user', content: userMessage }
        ], async (chunk) => {
            if (chunk) {
                await stream.pushChunk(chunk);
                hasPushed = true;
            }
        });

        if (!hasPushed) {
            if (intent === 'GREETING') await stream.pushChunk("Namaste bhai! Main Jobo AI hoon. Kaise madad karun?");
            else if (intent === 'IDENTITY') await stream.pushChunk("Main Jobo AI hoon, aapka Career Mentor. Main jobs aur exams ki jaankari deta hoon.");
            else await stream.pushChunk("Theek hai bhai, aur bataiye main kya madad kar sakta hoon?");
        }

        const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions: ["Latest jobs", "Career advice"] })}`;
        await stream.pushChunk(metadataStr);
        await stream.finishStream();
    }

    static _fixedSimpleResponse(intent) {
        if (intent === 'GREETING') {
            return "Namaste bhai! Main Jobo AI hoon. Jobs, exams aur career me kaise madad karun?";
        }
        if (intent === 'IDENTITY') {
            return "Main Jobo AI hoon, aapka career aur government jobs assistant.";
        }
        if (intent === 'ACKNOWLEDGEMENT') {
            return "Theek hai bhai, aur kuch chahiye ho toh batao.";
        }
        return null;
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
