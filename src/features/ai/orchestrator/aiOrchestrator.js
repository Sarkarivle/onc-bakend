/**
 * AIOrchestrator Module (Architectural Version 14.0 - Advanced Observer Pipeline)
 * Follows the Cognitive Architecture strictly with modern LLM Planner observability.
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

const PlannerLog = require('../models/PlannerLog');

class AIOrchestrator {
    static async _logDecision(query, plan, meta) {
        try {
            await PlannerLog.create({
                query,
                originalPlan: plan,
                userName: meta.userName,
                sessionId: meta.sessionId,
                modelUsed: process.env.AI_LOGIC_MODEL || "qwen2.5:1.5b",
                latency: meta.latency
            });
        } catch (e) { console.error("❌ Shadow Log Error:", e.message); }
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
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return { ...shapeResponse(safeResponse), requestId: traceId };
            }

            const [state, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            );

            const cognitiveContract = await Telemetry.trackStage(traceId, 'QUERY_UNDERSTANDING_ENGINE',
                () => IntentEngine.classify(userMessage, state, profile)
            );

            this._printPlannerSummary(cognitiveContract);

            Telemetry.setContext(traceId, {
                intent: cognitiveContract.intent,
                confidence: cognitiveContract.confidence,
                cognitiveMap: cognitiveContract.cognitiveMap
            });

            const plan = await Telemetry.trackStage(traceId, 'PLANNER_ENGINE',
                () => AgenticPlanner.generatePlan(userMessage, cognitiveContract, { state, profile, sessionId })
            );

            // --- SHADOW LOGGING: Save decision for future training ---
            this._logDecision(userMessage, plan, { userName, sessionId, latency: 0 });

            const fixedResponse = this._fixedSimpleResponse(plan.intent);
            if (fixedResponse) {
                const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
                await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                    () => PromptComposer.build([plan.intent], profile, {}, { plan, currentDate: istDate })
                );
                const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: "" });
                await this._persist(userName, sessionId, userMessage, fixedResponse, suggestions);
                await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                    () => BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: fixedResponse, plan, execResult: null, suggestions })
                );
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return { ...shapeResponse(fixedResponse, { suggestions }), requestId: traceId };
            }

            const execResult = await Telemetry.trackStage(traceId, 'EXECUTION_ENGINE',
                () => ExecutionEngine.executePlan(plan, { userMessage: plan.refinedQuery || userMessage, originalUserMessage: userMessage, profile, state, sessionId, plan })
            );

            // Manual mapping for telemetry (Search/Database/Ranking)
            if (plan.needsRAG) {
                Telemetry.logStageManual(traceId, 'SEARCH_ENGINE', Math.floor(execResult.metrics.latency * 0.6));
                Telemetry.logStageManual(traceId, 'DATABASE_ENGINE', Math.floor(execResult.metrics.latency * 0.2));
                Telemetry.logStageManual(traceId, 'RANKING_ENGINE', Math.floor(execResult.metrics.latency * 0.2));
            }

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: istDate })
            );

            const aiResponse = await Telemetry.trackStage(traceId, 'FINAL_LLM',
                () => LLMProvider.chat([
                    { role: 'system', content: promptData.systemPrompt },
                    { role: 'user', content: userMessage }
                ])
            );

            let finalContent = aiResponse.content;

            const allowLlmValidation = !(plan.searchStrategy?.skipLlmExpansion && plan.searchStrategy?.skipLlmRerank);
            const outputStatus = await Telemetry.trackStage(traceId, 'SAFETY_GUARDRAILS',
                () => ValidationEngine.validateOutput(userMessage, finalContent, liveData, { allowLlm: allowLlmValidation })
            );
            if (outputStatus.status === 'REPLACE') finalContent = outputStatus.content;

            const formatted = EliteFormatter.format(finalContent, { intent: plan.intent, userProfile: profile });
            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });

            await this._persist(userName, sessionId, userMessage, formatted, suggestions);

            await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                () => BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: formatted, plan, execResult, suggestions })
            );
            traceFinalized = true;
            Telemetry.endTrace(traceId);

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
            const prefetchStart = Date.now();
            const [gatewayStatus, [state, profile]] = await Promise.all([
                SmartGateway.validate(userMessage),
                Promise.all([SessionState.get(sessionId), UserProfile.get(userName, input)])
            ]);
            Telemetry.logStageManual(traceId, 'GATEWAY_VALIDATION', Date.now() - prefetchStart);
            Telemetry.logStageManual(traceId, 'CONTEXT_LOADING', Date.now() - prefetchStart);

            stream = new StreamingEngine(res, { turbo: false });
            const firstName = userName.split(' ')[0] || "Dost";
            stream.startThinking(`${firstName} bhai, bas ek minute, sab check kar loon...`);

            if (gatewayStatus.status === 'BLOCK') {
                const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
                await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                    () => PromptComposer.build(['SAFETY'], profile, {}, { plan: { intent: 'SAFETY_BLOCK' }, currentDate: istDate })
                );
                stream.error(new Error(this._safeGatewayResponse(gatewayStatus.reason)));
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return;
            }

            const intentStart = Date.now();
            const intentPromise = IntentEngine.classify(userMessage, state, profile);

            let speculativeRagPromise = null;
            const lastMsg = state.history?.length > 0 ? state.history[state.history.length-1].assistant : "";

            if (userMessage.length > 5 && !['hi', 'hello', 'ok'].includes(userMessage.toLowerCase())) {
                if (gatewayStatus.likelyIntent === 'JOB_SEARCH' || lastMsg.toLowerCase().includes('job')) {
                    stream.startThinking(`${firstName} bhai, tumhare liye sateek vacancy dhund raha hoon...`);
                } else {
                    stream.startThinking(`${firstName} bhai, tumhare sawal par gaur kar raha hoon...`);
                }
                speculativeRagPromise = RetrievalEngine.searchJobs(userMessage, profile, { searchStrategy: { skipLlmExpansion: true, skipLlmRerank: true } });
            }

            const cognitiveContract = await intentPromise;
            Telemetry.logStageManual(traceId, 'QUERY_UNDERSTANDING_ENGINE', Date.now() - intentStart);

            this._printPlannerSummary(cognitiveContract);

            Telemetry.setContext(traceId, {
                intent: cognitiveContract.intent,
                confidence: cognitiveContract.confidence,
                cognitiveMap: cognitiveContract.cognitiveMap
            });

            const plan = await Telemetry.trackStage(traceId, 'PLANNER_ENGINE',
                () => AgenticPlanner.generatePlan(userMessage, cognitiveContract, { state, profile, sessionId })
            );

            // --- SHADOW LOGGING: Save decision for future training ---
            this._logDecision(userMessage, plan, { userName, sessionId, latency: 0 });

            if (plan.canAnswerInstantly && plan.directResponse) {
                const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: "" });
                await stream.pushChunk(plan.directResponse);
                await stream.finishStream();
                await this._persist(userName, sessionId, userMessage, plan.directResponse, suggestions);
                await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                    () => BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: plan.directResponse, plan })
                );
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return;
            }

            const isTurbo = plan.reasoning === "⚡ Fast Semantic Intelligence" || plan.needsPlanning === false;
            const execStart = Date.now();
            let execResult = { outputs: {} };

            if (!isTurbo) {
                const actionText = plan.intent === 'JOB_SEARCH' ? "sarkari database scan kar raha hoon" : "best jankari nikal raha hoon";
                stream.startThinking(`${firstName} bhai, ab ${actionText}...`);
            }

            let ragOutput = null;
            if (speculativeRagPromise) ragOutput = await speculativeRagPromise;

            if (plan.needsRAG && (!ragOutput || ragOutput.count === 0)) {
                ragOutput = await RetrievalEngine.searchJobs(plan.refinedQuery || userMessage, profile, plan);
            }

            execResult = await ExecutionEngine.executePlan(plan, {
                userMessage: plan.refinedQuery || userMessage,
                originalUserMessage: userMessage,
                profile, state, sessionId, plan
            });

            if (plan.needsRAG) {
                execResult.outputs.rag = ragOutput;
                const totalExecTime = Date.now() - execStart;
                Telemetry.logStageManual(traceId, 'SEARCH_ENGINE', Math.floor(totalExecTime * 0.6));
                Telemetry.logStageManual(traceId, 'DATABASE_ENGINE', Math.floor(totalExecTime * 0.2));
                Telemetry.logStageManual(traceId, 'RANKING_ENGINE', Math.floor(totalExecTime * 0.2));
            }
            Telemetry.logStageManual(traceId, 'EXECUTION_ENGINE', Date.now() - execStart);

            const liveData = {
                jobs: execResult.outputs.rag?.jobs || "",
                memory: execResult.outputs.memory || {},
                calculator: execResult.outputs.calculator?.result || ""
            };

            const istDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
            const promptData = await Telemetry.trackStage(traceId, 'PROMPT_BUILDER',
                () => PromptComposer.build([plan.intent], profile, liveData, { plan, currentDate: istDate })
            );

            const llmStart = Date.now();
            let fullContent = "";
            let hasPushedAnyContent = false;
            let totalPushedLength = 0;

            const reinforcedUserMessage = isTurbo
                ? `${userMessage} (Direct jawab do, no tags needed)`
                : `${userMessage}\n\n(Note: Jawab Hinglish में दें)`;

            await LLMProvider.chatStream([
                { role: 'system', content: promptData.systemPrompt },
                { role: 'user', content: reinforcedUserMessage }
            ], async (chunk) => {
                if (!hasPushedAnyContent) {
                    const ttft = Date.now() - llmStart;
                    Telemetry.logStageManual(traceId, 'LLM_TTFT', ttft);
                    hasPushedAnyContent = true;
                }

                // ANTI-OVERLAP LOGIC: Skip chunks that are identical to the tail of the current content
                const newTokens = String(chunk || "");
                if (fullContent.endsWith(newTokens)) return;

                fullContent += newTokens;

                let cleanDisplay = fullContent
                    .replace(/<think>[\s\S]*?<\/think>/gi, '')
                    .replace(/<think>[\s\S]*/gi, '')
                    .replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/gi, '')
                    .replace(/<AGENT_THOUGHT>[\s\S]*/gi, '')
                    .replace(/<\/?USER_MESSAGE>/gi, '')
                    .trimStart();

                if (cleanDisplay.length > totalPushedLength) {
                    const newChunk = cleanDisplay.substring(totalPushedLength);
                    await stream.pushChunk(newChunk);
                    totalPushedLength = cleanDisplay.length;
                }
            });
            Telemetry.logStageManual(traceId, 'FINAL_LLM', Date.now() - llmStart);

            // Final processing after stream ends
            const finalContent = fullContent
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/gi, '')
                .replace(/<\/?USER_MESSAGE>/gi, '')
                .trim();

            const finalFormatted = EliteFormatter.format(finalContent,
                { intent: plan.intent, userProfile: profile, isFinal: true }
            );

            // If the final formatted content has more (like the closing), push the remainder
            if (finalFormatted.length > totalPushedLength) {
                const finalChunk = finalFormatted.substring(totalPushedLength);
                await stream.pushChunk(finalChunk);
            }

            const suggestions = SuggestionEngine.generate(plan, { topic: state.topic, jobs: liveData.jobs });
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions })}`;
            await stream.pushChunk(metadataStr);

            await stream.finishStream();

            await this._persist(userName, sessionId, userMessage, finalFormatted, suggestions);
            await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                () => BackgroundServices.runAll({ traceId, userName, userMessage, finalContent: finalFormatted, plan, execResult, suggestions })
            );
            traceFinalized = true;
            Telemetry.endTrace(traceId);

        } catch (error) {
            console.error("❌ Stream Pipeline Error:", error);
            if (stream) stream.error(error);
            if (!traceFinalized) Telemetry.endTrace(traceId);
        }
    }

    static _printPlannerSummary(c) {
        console.log('\n┌────────────── PLANNER DECISION ──────────────┐');
        console.log(`Primary Goal  : ${(c.primary_goal || 'N/A').substring(0, 45)}`);
        console.log(`Goal Type     : ${c.goal_type || 'N/A'}`);
        console.log(`Confidence    : ${c.confidence || '0.0'}`);
        console.log(`Priority      : ${c.priority || 'medium'}`);
        console.log(`Urgency       : ${c.urgency || 'normal'}`);
        console.log(`Need Memory   : ${c.need_memory ? 'YES' : 'NO'}`);
        console.log(`Need Search   : ${c.need_search ? 'YES' : 'NO'}`);
        console.log(`Need Database : ${c.need_database ? 'YES' : 'NO'}`);
        console.log(`Need Tools    : ${(c.need_tools || []).join(', ') || 'none'}`);
        console.log(`Execution     : ${c.execution_mode || 'sequential'}`);
        console.log(`Next Engines  :`);
        (c.next_engines || []).forEach(eng => console.log(`• ${eng}`));
        console.log(`Expected Output :`);
        console.log(`${(c.expected_output || 'N/A').substring(0, 45)}`);
        console.log('└──────────────────────────────────────────────┘\n');
    }

    static _fixedSimpleResponse(intent) {
        if (intent === 'GREETING') return "Namaste bhai! Main Jobo AI hoon. Jobs, exams aur career me kaise madad karun?";
        if (intent === 'IDENTITY') return "Main Jobo AI hoon, aapka career aur government jobs assistant.";
        if (intent === 'ACKNOWLEDGEMENT') return "Theek hai bhai, aur kuch chahiye ho toh batao.";
        return null;
    }

    static _safeGatewayResponse(reason) {
        const reasonMap = { EMPTY: 'EMPTY_INPUT', LENGTH_OVERFLOW: 'UNSAFE_OUTPUT', REPETITIVE: 'GIBBERISH', MALICIOUS_INTENT: 'MALICIOUS_INTENT', GIBBERISH: 'GIBBERISH', INJECTION_ATTEMPT: 'INJECTION_ATTEMPT' };
        return SAFE_RESPONSES[reasonMap[reason] || reason] || SAFE_RESPONSES.UNSAFE_OUTPUT;
    }

    static async _persist(userName, sessionId, query, response, suggestions) {
        try {
            if (Chat.db?.readyState !== 1) return;
            const name = userName || "User";

            if (query && query.trim()) {
                await Chat.create({ userName: name, sessionId, role: 'user', content: query });
            }

            if (response && response.trim()) {
                await Chat.create({ userName: name, sessionId, role: 'assistant', content: response, suggestions });
            } else {
                console.warn("⚠️ Skipping assistant persistence: Response content is empty.");
            }
        } catch (e) { console.error("❌ Persistence Error:", e.message); }
    }
}

// Warm up engines
console.log("🧠 Warming up Neural Engines...");
SemanticRouter.init().catch(e => console.error("Router Warmup Error:", e));

module.exports = AIOrchestrator;
