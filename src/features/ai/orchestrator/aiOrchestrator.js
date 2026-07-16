/**
 * AIOrchestrator Module (Architectural Version 14.0 - Advanced Observer Pipeline)
 * Follows the Cognitive Architecture strictly with modern LLM Planner observability.
 */
const Chat = require('../../chat/chatModel');
const SessionManager = require('../memory/SessionManager');
const UserProfile = require('../context/userProfile');
const LLMProvider = require('../generation/core_engine/llmProvider');
const SmartGateway = require('../quality/smartGateway');
const EliteFormatter = require('../quality/eliteFormatter');
const SuggestionEngine = require('../ux/suggestionEngine');
const StreamingEngine = require('./streamingEngine');
const Telemetry = require('./telemetryEngine');
const BackgroundServices = require('./backgroundServices');
const { shapeResponse, SAFE_RESPONSES, normalizeRequest } = require('../quality/safetyGuard');

const PlannerLog = require('../models/PlannerLog');
const AgentLoop = require('../reasoning/agentLoop');
const MasterOrchestrator = require('./MasterOrchestrator');
const NeuralAuditor = require('../quality/neuralAuditor');

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
     * Standard Synchronous Request (UPGRADED TO AGENTIC LOOP)
     */
    static async processRequest(input) {
        const { message, image_url, userName, sessionId = `session_${Date.now()}` } = input;
        const userMessage = normalizeRequest(input);
        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage, input.requestId);
        let traceFinalized = false;

        try {
            console.log(`📩 [AIOrchestrator] Request: ${userName} | Image: ${image_url ? 'YES' : 'NO'}`);

            const gatewayStatus = await Telemetry.trackStage(traceId, 'GATEWAY_VALIDATION',
                () => SmartGateway.validate(userMessage, !!image_url)
            );
            if (gatewayStatus.status === 'BLOCK') {
                const safeResponse = this._safeGatewayResponse(gatewayStatus.reason);
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return { ...shapeResponse(safeResponse), requestId: traceId };
            }
            if (gatewayStatus.status === 'GREET') {
                const greeting = this._fixedSimpleResponse('GREETING');
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return { ...shapeResponse(greeting), requestId: traceId };
            }

            const [history, profile] = await Telemetry.trackStage(traceId, 'CONTEXT_LOADING',
                () => Promise.all([
                    SessionManager.getHistory(sessionId, 10, userName),
                    UserProfile.get(userName, input)
                ])
            );

            // --- AGENTIC LOOP (SUPERVISOR-WORKER) ---
            const agentResult = await Telemetry.trackStage(traceId, 'AGENTIC_LOOP',
                () => MasterOrchestrator.processUserQuery(userMessage, history, {
                    profile,
                    sessionId,
                    userId: userName,
                    image_url: image_url // Using the destructured variable
                })
            );

            const { content, intent, capturedData } = agentResult;

            Telemetry.setContext(traceId, { intent });

            const formatted = EliteFormatter.format(content, { intent, userProfile: profile, evidence: capturedData.evidence });
            const suggestions = SuggestionEngine.generate({ intent }, { topic: 'CAREER', jobs: capturedData.jobs });

            await SessionManager.saveInteraction(userName, sessionId, userMessage, formatted);

            // NEURAL AUDIT (Background)
            NeuralAuditor.audit(userMessage, formatted, intent, 0, Date.now() - traceId).catch(() => {});

            await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                () => BackgroundServices.runAll({
                    traceId, userName, userMessage,
                    finalContent: formatted,
                    plan: { intent },
                    execResult: { outputs: capturedData },
                    suggestions
                })
            );

            traceFinalized = true;
            Telemetry.endTrace(traceId);
            return { ...shapeResponse(formatted, { suggestions }), requestId: traceId };

        } catch (error) {
            console.error("❌ Agentic Pipeline Error:", error);
            if (!traceFinalized) Telemetry.endTrace(traceId);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId: traceId };
        }
    }

    /**
     * Production-Grade Streaming Request (UPGRADED TO AGENTIC LOOP)
     */
    static async processRequestStream(input, res) {
        const { message, image_url, userName, sessionId = `session_${Date.now()}` } = input;
        const userMessage = normalizeRequest(input);
        const traceId = Telemetry.startTrace(userName || "Anonymous", sessionId, userMessage, input.requestId);
        let stream = null;
        let traceFinalized = false;

        try {
            console.log(`📩 [AIOrchestrator] Stream Request: ${userName} | Image: ${image_url ? 'YES' : 'NO'}`);

            const gatewayStatus = await SmartGateway.validate(userMessage, !!image_url);

            stream = new StreamingEngine(res, { turbo: false });
            const firstName = userName.split(' ')[0] || "Dost";

            if (gatewayStatus.status === 'BLOCK') {
                stream.error(new Error(this._safeGatewayResponse(gatewayStatus.reason)));
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return;
            }
            if (gatewayStatus.status === 'GREET') {
                const greeting = this._fixedSimpleResponse('GREETING');
                await stream.pushChunk(greeting);
                await stream.pushChunk(`\n\n[METADATA]${JSON.stringify({ suggestions: ["Latest jobs dikhao", "Career help chahiye", "Scholarship batao"], finalAnswer: greeting })}`);
                await stream.finishStream();
                traceFinalized = true;
                Telemetry.endTrace(traceId);
                return;
            }

            stream.startThinking(`${firstName} bhai, sab check kar loon...`);

            const [history, profile] = await Promise.all([
                SessionManager.getHistory(sessionId, 10, userName),
                UserProfile.get(userName, input)
            ]);

            // --- AGENTIC LOOP (SUPERVISOR-WORKER) ---
            let streamedLive = false;
            const onToken = (token) => {
                streamedLive = true;
                stream.pushChunk(token);
            };

            const agentResult = await Telemetry.trackStage(traceId, 'AGENTIC_LOOP',
                () => MasterOrchestrator.processUserQuery(userMessage, history, {
                    profile,
                    sessionId,
                    userId: userName,
                    image_url: image_url, // Using the destructured variable
                    onToken
                })
            );

            const { content, intent, capturedData, messages } = agentResult;

            Telemetry.setContext(traceId, { intent });

            // Final, corrected/formatted answer replaces the raw streamed text on the client.
            const formatted = EliteFormatter.format(content, { intent, userProfile: profile, evidence: capturedData.evidence });
            const suggestions = SuggestionEngine.generate({ intent }, { topic: 'CAREER', jobs: capturedData.jobs });

            if (!streamedLive) await stream.pushChunk(formatted);
            const metadataStr = `\n\n[METADATA]${JSON.stringify({ suggestions, finalAnswer: formatted })}`;
            await stream.pushChunk(metadataStr);
            await stream.finishStream();

            await SessionManager.saveInteraction(userName, sessionId, userMessage, formatted);
            await Telemetry.trackStage(traceId, 'BACKGROUND_SERVICES',
                () => BackgroundServices.runAll({
                    traceId, userName, userMessage,
                    finalContent: formatted,
                    plan: { intent },
                    execResult: { outputs: capturedData },
                    suggestions
                })
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
        if (intent === 'GREETING') return "Namaste! Main Jobo AI hoon, aapka career aur government jobs assistant. Main aaj aapki kaise madad kar sakta hoon?";
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

            const sanitize = (content) => {
                if (typeof content === 'string') return content;
                if (Array.isArray(content)) {
                    const textNode = content.find(node => node.type === 'text');
                    return textNode ? textNode.text : "[Image Interaction]";
                }
                return String(content || "");
            };

            const safeQuery = sanitize(query);
            const safeResponse = sanitize(response);

            if (safeQuery && safeQuery.trim()) {
                await Chat.create({ userName: name, sessionId, role: 'user', content: safeQuery });
            }

            if (safeResponse && safeResponse.trim()) {
                await Chat.create({ userName: name, sessionId, role: 'assistant', content: safeResponse, suggestions });
            } else {
                console.warn("⚠️ Skipping assistant persistence: Response content is empty.");
            }
        } catch (e) { console.error("❌ Persistence Error:", e.message); }
    }
}

// Warm up engines
console.log("🧠 Warming up Agentic Loop...");

module.exports = AIOrchestrator;
