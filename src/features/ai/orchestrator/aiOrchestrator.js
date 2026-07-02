/**
 * AIOrchestrator Module (Architectural Version 13.0 - Neural Pipeline)
 * Follows the Cognitive Architecture strictly:
 * Gateway -> Controller -> Execution -> Retrieval -> Prompt -> Final LLM -> Validation -> Stream
 */
const Chat = require('../../chat/chatModel');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const IntentEngine = require('../intent/intentEngine');
const AgenticPlanner = require('../reasoning/agenticPlanner');
const ExecutionEngine = require('./executionEngine');
const PromptComposer = require('../generation/promptComposer');
const LLMProvider = require('../generation/core_engine/llmProvider');
const ValidationEngine = require('../quality/validationEngine');
const SmartGateway = require('../quality/smartGateway');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');
const StreamingEngine = require('./streamingEngine');
const Telemetry = require('./telemetryEngine');
const BackgroundServices = require('./backgroundServices');
const RetrievalEngine = require('../knowledge/retrievalEngine');
const SemanticRouter = require('../intent/SemanticRouter');
const { shapeResponse, SAFE_RESPONSES, normalizeRequest } = require('../quality/safetyGuard');

class AIOrchestrator {
    // Eagerly initialize components on startup
    static {
        console.log("🧠 Warming up Neural Engines...");
        SemanticRouter.init().catch(e => console.error("Router Warmup Error:", e));
    }

    /**
     * Standard Synchronous Request
     */
    static async processRequest(input) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;
        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage, input.requestId);
        let traceFinalized = false;

        try {
            // 1. API GATEWAY STAGE
            const gatewayStatus = await Telemetry.trackStage(traceId, 'GATEWAY_VALIDATION',
                () => SmartGateway.validate(userMessage)
            );
            if (gatewayStatus.status === 'BLOCK') {
                const safeResponse = this._safeGatewayResponse(gatewayStatus.reason);
                const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
                await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                    () => PromptComposer.build(['SAFETY'], {}, {}, { plan: { intent: 'SAFETY_BLOCK' }, currentDate: istDate })
                );
                Telemetry.setContext(traceId, { intent: 'SAFETY_BLOCK', confidence: 1 });
                Telemetry.endTrace(traceId);
                traceFinalized = true;
                return { ...shapeResponse(safeResponse), requestId: traceId };
            }

            // 2. CONTEXT LOADING
            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            // 3. QUERY UNDERSTANDING ENGINE
            const cognitiveContract = await Telemetry.trackStage(traceId, 'QUERY_UNDERSTANDING_ENGINE',
                () => IntentEngine.classify(userMessage, state, profile)
            );
            Telemetry.setContext(traceId, {
                intent: cognitiveContract.intent,
                confidence: cognitiveContract.confidence,
                cognitiveMap: cognitiveContract.cognitiveMap
            });

            // 4. PLANNER ENGINE
            const plan = await Telemetry.trackStage(traceId, 'PLANNER_ENGINE',
                () => AgenticPlanner.generatePlan(userMessage, cognitiveContract, { state, profile, sessionId })
            );

            const fixedResponse = this._fixedSimpleResponse(plan.intent);
            if (fixedResponse) {
                const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
                await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                    () => PromptComposer.build([plan.intent], profile, {}, { plan, currentDate: istDate })
                );
                const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: "" });
                await this._persist(userName, sessionId, userMessage, fixedResponse, suggestions);
                BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: fixedResponse, plan, execResult: null, suggestions });
                traceFinalized = true;
                return { ...shapeResponse(fixedResponse, { suggestions }), requestId: traceId };
            }

            // 5. EXECUTION ENGINE
            const execResult = await Telemetry.trackStage(traceId, 'EXECUTION_ENGINE',
                () => ExecutionEngine.executePlan(plan, { userMessage: plan.refinedQuery || userMessage, originalUserMessage: userMessage, profile, state, sessionId, plan })
            );

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            // 6. PROMPT BUILDER
            const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: istDate })
            );

            // 7. FINAL LLM (Synthesis)
            const aiResponse = await Telemetry.trackStage(traceId, 'FINAL_LLM',
                () => LLMProvider.chat([
                    { role: 'system', content: promptData.systemPrompt },
                    { role: 'user', content: userMessage }
                ])
            );

            let finalContent = aiResponse.content;

            // 8. SAFETY GUARDRAILS + RESPONSE VALIDATOR
            const allowLlmValidation = !(plan.searchStrategy?.skipLlmExpansion && plan.searchStrategy?.skipLlmRerank);
            const outputStatus = await Telemetry.trackStage(traceId, 'SAFETY_GUARDRAILS',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData, { allowLlm: allowLlmValidation })
            );
            if (outputStatus.status === 'REPLACE') finalContent = outputStatus.content;

            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: formatted, plan, execResult, suggestions });
            traceFinalized = true;

            return { ...shapeResponse(formatted, { suggestions, cognitiveMap: plan.cognitiveMap }), requestId: traceId };

        } catch (error) {
            console.error("❌ Neural Pipeline Error:", error);
            if (!traceFinalized) Telemetry.endTrace(traceId);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId: traceId };
        }
    }

    /**
     * Production-Grade Streaming Request
     */
    static async processRequestStream(input, res) {
        const userMessage = normalizeRequest(input);
        const { userName, sessionId = `session_${Date.now()}` } = input;
        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage, input.requestId);
        const overallStart = Date.now();
        let stream = null;
        let traceFinalized = false;

        console.log(`\n[PIPELINE_START] User: ${userName} | Query: "${userMessage}"`);

        try {
            // 1. FAST PRE-FETCH
            const prefetchStart = Date.now();
            const [gatewayStatus, [state, profile]] = await Promise.all([
                SmartGateway.validate(userMessage),
                Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            ]);
            console.log(`⏱️ Stage 1 (Gateway+Context): ${Date.now() - prefetchStart}ms`);

            // Initialize stream early to send personalized status
            stream = new StreamingEngine(res, { turbo: false });
            const firstName = userName.split(' ')[0] || "Dost";
            stream.startThinking(`${firstName} bhai, bas ek minute, sab check kar loon...`);

            if (gatewayStatus.status === 'BLOCK') {
                const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
                await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                    () => PromptComposer.build(['SAFETY'], profile, {}, { plan: { intent: 'SAFETY_BLOCK' }, currentDate: istDate })
                );
                stream.error(new Error(this._safeGatewayResponse(gatewayStatus.reason)));
                Telemetry.endTrace(traceId);
                traceFinalized = true;
                return;
            }

            // SPECULATIVE RAG (Turbo)
            let speculativeRagPromise = null;
            const lastMsg = state.history?.length > 0 ? state.history[state.history.length-1].assistant : "";

            if (gatewayStatus.likelyIntent === 'JOB_SEARCH' || (userMessage.length < 10 && lastMsg.toLowerCase().includes('job'))) {
                stream.startThinking(`${firstName} bhai, tumhare liye sateek vacancy dhund raha hoon...`);
                speculativeRagPromise = RetrievalEngine.searchJobs(userMessage, profile, { searchStrategy: { skipLlmExpansion: true, skipLlmRerank: true } });
            }

            // 2. QUERY UNDERSTANDING ENGINE + PLANNER ENGINE
            // 2. PARALLEL INTENT DETECTION + SPECULATIVE RETRIEVAL
            // This is how Big Players achieve near-zero latency.
            const intentStart = Date.now();
            const firstName = userName.split(' ')[0] || "Dost";
            stream.startThinking(`${firstName} bhai, bas ek minute, sab check kar loon...`);

            // Start Intent Detection (Neural Architect)
            const intentPromise = Telemetry.trackStage(traceId, 'QUERY_UNDERSTANDING_ENGINE',
                () => IntentEngine.classify(userMessage, state, profile)
            );

            // Speculatively start RAG if it looks like a job query (Zero-Wait Path)
            let speculativeRagPromise = null;
            if (userMessage.length > 5 && !['hi', 'hello', 'ok'].includes(userMessage.toLowerCase())) {
                speculativeRagPromise = RetrievalEngine.searchJobs(userMessage, profile, { searchStrategy: { skipLlmExpansion: true, skipLlmRerank: true } });
            }

            // Await Intent first as it's the brain
            const cognitiveContract = await intentPromise;

            Telemetry.setContext(traceId, {
                intent: cognitiveContract.intent,
                confidence: cognitiveContract.confidence,
                cognitiveMap: cognitiveContract.cognitiveMap
            });

            const plan = await Telemetry.trackStage(traceId, 'PLANNER_ENGINE',
                () => AgenticPlanner.generatePlan(userMessage, cognitiveContract, { state, profile, sessionId })
            );

            // 3. SHORT-CIRCUIT / DYNAMIC FUSION
            if (plan.canAnswerInstantly && plan.directResponse) {
                const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: "" });
                await stream.pushChunk(plan.directResponse);
                await stream.finishStream();
                await this._persist(userName, sessionId, userMessage, plan.directResponse, suggestions);
                BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: plan.directResponse, plan });
                traceFinalized = true;
                console.log(`⚡ Short-Circuit Response Total: ${Date.now() - overallStart}ms`);
                return;
            }

            const isTurbo = plan.reasoning === "⚡ Fast Semantic Intelligence" || plan.needsPlanning === false;

            // 4. EXECUTION ENGINE (Reuse speculative results if available)
            const execStart = Date.now();
            let execResult;

            if (plan.needsRAG && speculativeRagPromise) {
                const ragOutput = await speculativeRagPromise;
                execResult = await ExecutionEngine.executePlan(plan, { userMessage: plan.refinedQuery || userMessage, originalUserMessage: userMessage, profile, state, sessionId, plan });
                execResult.outputs.rag = ragOutput; // Fusion
            } else {
                execResult = await ExecutionEngine.executePlan(plan, { userMessage: plan.refinedQuery || userMessage, originalUserMessage: userMessage, profile, state, sessionId, plan });
            }
            console.log(`⏱️ Stage 3 (Parallel Execution): ${Date.now() - execStart}ms`);
            console.log(`⏱️ Stage 3 (Execution/RAG): ${Date.now() - execStart}ms`);

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            // 5. PROMPT BUILDER
            const promptStart = Date.now();
            const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
            const promptData = await PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: istDate });
            console.log(`⏱️ Stage 4 (Prompt Builder): ${Date.now() - promptStart}ms`);

            // 6. FINAL LLM (Streaming)
            const llmStart = Date.now();
            let fullContent = "";
            let hasPushedAnyContent = false;
            let totalPushedLength = 0;

            // INSTANT ACKNOWLEDGEMENT: Send a friendly starter while LLM warms up
            const initialAck = isTurbo ? `Zaroor ${firstName} bhai, ye rahi info...\n\n` : `Haan ${firstName} bhai, ek minute dhoond raha hoon...\n\n`;
            await stream.pushChunk(initialAck);
            totalPushedLength = initialAck.length;
            hasPushedAnyContent = true;

            // In Turbo mode, we tell the model to be direct
            const reinforcedUserMessage = isTurbo
                ? `${userMessage} (Direct jawab do, no tags needed)`
                : `${userMessage}\n\n(Note: Jawab Hinglish में दें)`;

            await LLMProvider.chatStream([
                { role: 'system', content: promptData.systemPrompt },
                { role: 'user', content: reinforcedUserMessage }
            ], async (chunk) => {
                if (!hasPushedAnyContent) {
                    const ttft = Date.now() - llmStart;
                    console.log(`⏱️ Stage 5 (LLM TTFT - First Token): ${ttft}ms`);
                    hasPushedAnyContent = true;
                }

                fullContent += chunk;

                // Robust Streaming Filter:
                // 1. Remove finalized thought blocks
                // 2. Hide ongoing thought blocks
                // 3. Strip all internal tags
                let cleanDisplay = fullContent
                    .replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/gi, '')
                    .replace(/<AGENT_THOUGHT>[\s\S]*/gi, '')
                    .replace(/<\/?USER_MESSAGE>/gi, '')
                    .trimStart();

                // To prevent repetition, we only push if the clean content has actually grown
                if (cleanDisplay.length > totalPushedLength) {
                    const newChunk = cleanDisplay.substring(totalPushedLength);
                    await stream.pushChunk(newChunk);
                    totalPushedLength = cleanDisplay.length;
                }
            });
            console.log(`⏱️ Stage 6 (LLM Finish): ${Date.now() - llmStart}ms`);
            console.log(`🚀 Overall Pipeline Total: ${Date.now() - overallStart}ms\n`);

            // 8. FINALIZING & METADATA INJECTION (Crucial for Flutter)
            const finalContent = fullContent
                .replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/gi, '')
                .replace(/<\/?USER_MESSAGE>/gi, '')
                .trim();

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
            traceFinalized = true;

        } catch (error) {
            console.error("❌ Stream Pipeline Error:", error);
            if (stream) stream.error(error);
            else if (res && !res.headersSent) res.status(200).json({ success: false, message: SAFE_RESPONSES.GENERIC_FALLBACK, answer: "" });
            else if (res && !res.writableEnded) res.end();
            if (!traceFinalized) Telemetry.endTrace(traceId);
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
        const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
        const promptData = await PromptComposer.build([intent], profile, {}, { plan, currentDate: istDate });
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

    static _safeGatewayResponse(reason) {
        const reasonMap = {
            EMPTY: 'EMPTY_INPUT',
            LENGTH_OVERFLOW: 'UNSAFE_OUTPUT',
            REPETITIVE: 'GIBBERISH',
            MALICIOUS_INTENT: 'MALICIOUS_INTENT',
            GIBBERISH: 'GIBBERISH',
            INJECTION_ATTEMPT: 'INJECTION_ATTEMPT'
        };
        return SAFE_RESPONSES[reasonMap[reason] || reason] || SAFE_RESPONSES.UNSAFE_OUTPUT;
    }

    static async _persist(userName, sessionId, query, response, suggestions) {
        try {
            if (Chat.db?.readyState !== 1) return;
            const name = userName || "User";
            await Chat.create({ userName: name, sessionId, role: 'user', content: query });
            await Chat.create({ userName: name, sessionId, role: 'assistant', content: response, suggestions });
        } catch (e) { console.error("❌ Persistence Error:", e.message); }
    }
}

module.exports = AIOrchestrator;
