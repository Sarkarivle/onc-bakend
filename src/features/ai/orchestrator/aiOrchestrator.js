/**
 * AIOrchestrator Module (Formerly AIService)
 * Responsibility: Enterprise AI Orchestrator that manages the Phase 1-12 pipeline.
 */
const Chat = require('../../chat/chatModel');
const {
    normalizeRequest,
    preLlmChecks,
    postLlmFilter,
    shapeResponse,
    SAFE_RESPONSES,
    semanticSafeFallback
} = require('../quality/safetyGuard');
const Settings = require('../../settings/settingsModel');
const Job = require('../../jobs/jobModel');
const constants = require('../../../config/constants');
const cheerio = require('cheerio');

// Pipeline Modules (Updated Paths)
const RuleDetector = require('../intent/detectors/ruleDetector');
const IntentEngine = require('../intent/intentEngine');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const MemoryManager = require('../context/memoryManager');
const QueryRewriter = require('../intent/normalizers/queryRewriter');
const ResponsePlanner = require('../reasoning/responsePlanner');
const AgenticPlanner = require('../reasoning/agenticPlanner');
const KnowledgeRouter = require('../reasoning/knowledgeRouter');
const PromptComposer = require('../generation/promptComposer');
const SearchService = require('../knowledge/searchService');
const Validator = require('../quality/validator');
const NeuralValidator = require('../quality/neuralValidator');
const Cleaner = require('../quality/cleaner');
const Formatter = require('../quality/formatter');
const EliteFormatter = require('../quality/eliteFormatter');
const ConfidenceEngine = require('../ux/confidenceEngine');
const SuggestionEngine = require('../ux/suggestionEngine');
const ProgressEmitter = require('../ux/progressEmitter');
const SmartGateway = require('../quality/smartGateway');

// Infrastructure Layers
const LLMProvider = require('../generation/llmProvider');
const Metrics = require('../utils/metrics');
const SearchReranker = require('../knowledge/searchReranker');
const VectorService = require('../knowledge/vectorService');
const RetrievalEngine = require('../knowledge/retrievalEngine');

class AIOrchestrator {
    static async processRequest(input) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const userMessage = normalizeRequest(input);

        // PHASE 1 Evolution: Neural Gateway Check (Replaces keywords)
        const gateway = await SmartGateway.validate(userMessage);

        if (gateway.status === 'GREET') {
            return { ...shapeResponse(SAFE_RESPONSES.GREETING), requestId };
        }

        if (gateway.status === 'BLOCK') {
            const fallback = gateway.reason === 'MALICIOUS_INTENT'
                ? SAFE_RESPONSES.INJECTION_ATTEMPT
                : SAFE_RESPONSES.EMPTY_INPUT;
            return { ...shapeResponse(fallback), requestId };
        }

        const { userName, history } = input;
        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = userMessage;

        ProgressEmitter.emit(sessionId, 'REQUEST_RECEIVED');
        ProgressEmitter.emit(sessionId, 'INPUT_PROCESSING');

        let metrics = { intent: 'UNKNOWN', provider: 'NONE', searchUsed: false, requestId };

        try {
            ProgressEmitter.emit(sessionId, 'CONVERSATION_STATE_LOADING');
            const [state, profile] = await Promise.all([
                SessionState.get(sessionId),
                UserProfile.get(userName, input)
            ]);
            ProgressEmitter.emit(sessionId, 'USER_PROFILE_LOADING');

            ProgressEmitter.emit(sessionId, 'INTENT_DETECTION');
            const resolvedIntent = await IntentEngine.classify(rawInput, {
                ...state,
                lastAssistantResponse: state.aiResponse || ""
            }, profile);
            const intentObj = RuleDetector.detect(rawInput);

            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                await UserProfile.syncToDb(userName, resolvedIntent.entities);
            }

            ProgressEmitter.emit(sessionId, 'PLANNING');
            // PHASE 4: Evolution - AI decides the plan (Agentic)
            const plan = await AgenticPlanner.generatePlan(rawInput, resolvedIntent, {
                topic: state.topic,
                profileStr: UserProfile.toContextString(profile),
                insights: state.insights,
                summary: state.summary
            });
            metrics.intent = plan.mode;

            const rewrittenQuery = resolvedIntent.refinedQuery || rawInput;

            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile), referencedItem: plan.referencedItem, topic: state.topic };

            if (plan.needsDatabase || plan.needsWebSearch) {
                if (plan.needsDatabase) ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');

                let [dbResult, webData] = await Promise.all([
                    plan.needsDatabase ? RetrievalEngine.searchJobs(rewrittenQuery, profile, plan) : null,
                    plan.needsWebSearch ? this._fetchWebKnowledge(rewrittenQuery) : null
                ]);

                // --- PHASE 8 Evolution: Agentic Multihop (The Pivot) ---
                const dataIsMissing = (!dbResult || !dbResult.jobs) && !webData;
                const isFactualNeed = ['JOB_SEARCH', 'JOB_DETAILS'].includes(plan.mode);

                if (dataIsMissing && isFactualNeed) {
                    ProgressEmitter.emit(sessionId, 'DATABASE_EMPTY_PIVOTING');
                    const pivot = await AgenticPlanner.generatePivotPlan(rewrittenQuery, "No direct results found", { topic: state.topic });

                    if (pivot && pivot.newSearchQuery) {
                        console.log(`🔄 Multihop: Pivoting to "${pivot.newSearchQuery}" via ${pivot.tool}`);
                        if (pivot.tool === 'DATABASE') {
                            dbResult = await RetrievalEngine.searchJobs(pivot.newSearchQuery, profile, plan);
                        } else {
                            webData = await this._fetchWebKnowledge(pivot.newSearchQuery);
                            metrics.searchUsed = true;
                        }
                    }
                }

                if (dbResult && dbResult.jobs) knowledgeContext.jobs = dbResult.jobs;
                if (webData) knowledgeContext.web = webData;
            }

            ProgressEmitter.emit(sessionId, 'PROMPT_COMPOSING');
            const options = { timeZone: "Asia/Kolkata", day: '2-digit', month: 'long', year: 'numeric' };
            const indiaDateStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());
            const currentYear = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", year: 'numeric' });

            const promptMeta = { currentDate: indiaDateStr, currentYear, sessionId, behavior: plan.behavior, turnCount: state.turnCount || 0, plan };
            let systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            if (plan.behavior === 'CLARIFY') {
                systemInstruction += "\n\nCRITICAL: The user's query is too short or ambiguous. Do not guess. Politely ask them to explain their question in detail.";
            }

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');
            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            let aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. Only discuss jobs active in ${currentYear} or later.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            let llmContent = aiResponse.content;

            // PHASE 5 Evolution: Neural Self-Critique & Repair
            ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');
            const audit = await NeuralValidator.validate(rewrittenQuery, llmContent, knowledgeContext);

            if (!audit.passed && audit.repairInstruction) {
                ProgressEmitter.emit(sessionId, `CHALLENGE_MODE_REPAIR`);
                const repairResponse = await llm.chat([
                    { role: 'system', content: systemInstruction },
                    ...(history || []),
                    { role: 'user', content: rewrittenQuery },
                    { role: 'assistant', content: llmContent },
                    { role: 'system', content: `[CRITIQUE]: ${audit.repairInstruction}\nFix the issues mentioned and provide the final corrected response.` }
                ]);
                llmContent = repairResponse.content;
            }

            const validationInput = { query: rewrittenQuery, liveData: knowledgeContext, intent: plan.intent, userProfile: profile, isPureGreeting: plan.isPureGreeting || plan.behavior === 'GREET', resolvedIntent, state, plan };
            let validation = Validator.validate(llmContent, validationInput);

            let finalContent = postLlmFilter(llmContent, rawInput);
            if (!validation.passed && validationInput.isPureGreeting) {
                finalContent = Cleaner.getGreetingFallback();
            }

            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(finalContent, confidence, { intent: plan.intent || resolvedIntent.primaryIntent, query: rewrittenQuery, isPureGreeting: validationInput.isPureGreeting, userProfile: profile, plan, knowledgeContext });

            // PHASE 6: Extract Memory Insights (Fire & Forget for speed, or await for consistency)
            const memoryUpdate = await MemoryManager.extractInsights(rawInput, processed.message, state.insights);

            await SessionState.update(sessionId, {
                query: rawInput,
                acts: intentObj.acts,
                domains: intentObj.domains,
                intents: intentObj.intents,
                resolvedIntent,
                aiResponse: processed.message,
                plan,
                knowledgeContext,
                userName,
                insights: memoryUpdate.updatedInsights,
                turnSummary: memoryUpdate.turnSummary
            });

            metrics.latency = Date.now() - startTime;
            Metrics.logRequest(metrics);
            await this._persistChat(userName, sessionId, rawInput, processed, metrics, state.topic);

            const { message, ...extraFields } = processed;
            const finalResponse = shapeResponse(message, extraFields);

            ProgressEmitter.emit(sessionId, 'FINAL_RESPONSE_READY');
            return { ...finalResponse, confidence: confidence.score, topic: state.topic, requestId };

        } catch (error) {
            ProgressEmitter.emit(sessionId, 'ERROR');
            console.error("❌ Orchestration Error:", error);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId };
        }
    }

    static async processRequestStream(input, onChunk) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const userMessage = normalizeRequest(input);

        // --- EMERGENCY GREETING BYPASS ---
        const gateway = await SmartGateway.validate(userMessage);
        if (gateway.status === 'GREET') {
            onChunk(SAFE_RESPONSES.GREETING);
            onChunk(`\n\n[METADATA]${JSON.stringify({ success: true, requestId, isFullResponse: true, suggestions: ["Sarkari Naukri", "Career Advice"] })}`);
            return;
        }

        const { userName, history } = input;
        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = userMessage;

        try {
            const [state, profile] = await Promise.all([
                SessionState.get(sessionId),
                UserProfile.get(userName, input)
            ]);

            const resolvedIntent = await IntentEngine.classify(rawInput, state, profile);
            const intentObj = RuleDetector.detect(rawInput);

            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                await UserProfile.syncToDb(userName, resolvedIntent.entities);
            }

            // PHASE 4 Evolution: Agentic Planning for Streaming
            const plan = await AgenticPlanner.generatePlan(rawInput, resolvedIntent, {
                topic: state.topic,
                profileStr: UserProfile.toContextString(profile)
            });

            const searchQuery = resolvedIntent.refinedQuery || rawInput;

            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile), referencedItem: plan.referencedItem, topic: state.topic };
            if (plan.needsDatabase || plan.needsWebSearch) {
                let [dbResult, webData] = await Promise.all([
                    plan.needsDatabase ? RetrievalEngine.searchJobs(searchQuery, profile, plan) : null,
                    plan.needsWebSearch ? this._fetchWebKnowledge(searchQuery) : null
                ]);
                if (dbResult && dbResult.jobs) knowledgeContext.jobs = dbResult.jobs;
                if (webData) knowledgeContext.web = webData;
            }

            const options = { timeZone: "Asia/Kolkata", day: '2-digit', month: 'long', year: 'numeric' };
            const indiaDateStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());
            const currentYear = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", year: 'numeric' });

            const promptMeta = { currentDate: indiaDateStr, currentYear, sessionId, behavior: plan.behavior, turnCount: state.turnCount || 0, plan };
            let systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            const llm = await this._getLLMProvider();

            let fullContent = "";
            await llm.chatStream([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. Only discuss jobs active in ${currentYear} or later.` },
                ...(history || []),
                { role: 'user', content: searchQuery }
            ], (chunk) => {
                fullContent += chunk;
                onChunk(chunk);
            });

            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, { passed: true });
            const processed = this._finalProcess(fullContent, confidence, {
                intent: plan.intent || resolvedIntent.primaryIntent,
                query: searchQuery,
                userProfile: profile,
                plan: plan,
                knowledgeContext: knowledgeContext
            });

            await SessionState.update(sessionId, {
                query: rawInput,
                acts: intentObj.acts,
                domains: intentObj.domains,
                intents: intentObj.intents,
                resolvedIntent: resolvedIntent,
                aiResponse: processed.message,
                plan: plan,
                knowledgeContext: knowledgeContext,
                userName
            });

            onChunk(`\n\n[METADATA]${JSON.stringify({
                confidence: confidence.score,
                topic: state.topic,
                requestId,
                suggestions: processed.suggestions
            })}`);

        } catch (error) {
            console.error("❌ Streaming Orchestration Error:", error);
            onChunk(SAFE_RESPONSES.GENERIC_FALLBACK);
            onChunk(`\n\n[METADATA]${JSON.stringify({ success: false, requestId, suggestions: ["Try again"] })}`);
        }
    }

    static async _getLLMProvider() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        let baseUrl = setting?.value || constants.DEFAULT_RUNPOD_URL;
        baseUrl = baseUrl.replace(/\/api\/chat\/?$/, '').replace(/\/$/, '');
        const finalUrl = `${baseUrl}/api/chat`;

        return new LLMProvider({
            baseUrl: finalUrl,
            model: constants.AI_MODEL_NAME
        });
    }

    static async _fetchWebKnowledge(query) {
        const [key, cx] = await Promise.all([Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }), Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })]);
        const apiKey = key?.value;
        const cxId = cx?.value;

        if (!apiKey) return "";
        const results = await SearchService.search(query, apiKey, cxId);
        const reranked = SearchReranker.rank(query, results);

        return reranked.map((r, i) => `SOURCE ${i + 1}: [TITLE: ${r.title}] [URL: ${r.url}] [SNIPPET: ${r.snippet}]`).join("\n");
    }

    static _finalProcess(content, confidence, meta = {}) {
        const thoughtMatch = content.match(/<AGENT_THOUGHT>([\s\S]*?)<\/AGENT_THOUGHT>/i);
        const userMsgMatch = content.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
        let message = userMsgMatch ? userMsgMatch[1].trim() : content.replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/i, '').trim();

        message = Cleaner.clean(message, meta);
        message = EliteFormatter.format(message, meta);

        const aiSuggestions = [];
        const suggestions = SuggestionEngine.generate(meta.plan, meta.knowledgeContext, aiSuggestions);

        return { message, thought: thoughtMatch ? thoughtMatch[1].trim() : "", suggestions };
    }

    static async _persistChat(user, session, input, processed, metrics, topic) {
        if (!user || !processed.message) return;
        await Chat.create({ userName: user, sessionId: session, role: 'user', content: input });
        await Chat.create({ userName: user, sessionId: session, role: 'assistant', content: processed.message, thought: processed.thought, suggestions: processed.suggestions, metadata: { confidence: metrics.confidence, topic } });
    }
}

module.exports = AIOrchestrator;
