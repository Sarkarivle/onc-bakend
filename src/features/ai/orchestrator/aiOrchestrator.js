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
const IntentEngine = require('../intent/intentEngine');
const SessionState = require('../context/sessionState');
const UserProfile = require('../context/userProfile');
const MemoryManager = require('../context/memoryManager');
const QueryRewriter = require('../intent/normalizers/queryRewriter');
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
const StateModel = require('../memory/stateModel');

class AIOrchestrator {
    static async processRequest(input) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const userMessage = normalizeRequest(input);

        // Fast local greeting guard: simple greetings must never enter the RAG
        // or no-data fallback path, otherwise users see greeting + factual fallback.
        if (this._isSimpleGreeting(userMessage)) {
            return { ...shapeResponse(Cleaner.getGreetingFallback()), requestId };
        }

        const directConversation = this._getDirectConversationResponse(userMessage);
        if (directConversation) {
            return { ...shapeResponse(directConversation.message, { suggestions: directConversation.suggestions }), requestId };
        }

        const profileCorrection = this._getProfileCorrectionResponse(userMessage);
        if (profileCorrection) {
            await this._clearDeniedQualificationFromState(input.sessionId, userMessage);
            return { ...shapeResponse(profileCorrection.message, { suggestions: profileCorrection.suggestions }), requestId };
        }

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

            // --- SYNC POINT: Ensure Profile (Source of Truth) overrides Memory (Insights) ---
            state.insights = this._mergeInsightsWithProfile(state.insights, profile);

            ProgressEmitter.emit(sessionId, 'INTENT_DETECTION');
            const resolvedIntent = await IntentEngine.classify(rawInput, {
                ...state,
                lastAssistantResponse: state.aiResponse || ""
            }, profile);
            const deniedQualification = this._getDeniedQualification(rawInput);

            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                const safeEntities = { ...resolvedIntent.entities };
                if (deniedQualification && safeEntities.qualification) {
                    delete safeEntities.qualification;
                }

                await UserProfile.syncToDb(userName, safeEntities);
                if (resolvedIntent.entities.name) profile.name = resolvedIntent.entities.name;
                if (safeEntities.qualification) profile.qualification = safeEntities.qualification;
                if (resolvedIntent.entities.location) profile.state = resolvedIntent.entities.location;
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

                    // Deterministic fallback: factual job searches should try web search
                    // when the database and agentic pivot still produce no usable data.
                    // This keeps the assistant helpful without inventing job records.
                    if ((!dbResult || !dbResult.jobs) && !webData) {
                        webData = await this._fetchWebKnowledge(rewrittenQuery);
                        metrics.searchUsed = Boolean(webData);
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

            if (plan.behavior === 'GREET' || resolvedIntent.primaryIntent === 'GREETING') {
                systemInstruction += "\n\nCRITICAL: The user is greeting you or asking how you are. Respond warmly in Hinglish and ask how you can help with their career or jobs.";
            }

            if (plan.behavior === 'CLARIFY') {
                systemInstruction += "\n\nCRITICAL: The user's query is too short or ambiguous. Do not guess. Politely ask them to explain their question in detail.";
            }

            // Flexible fallback for missing data (Gemini Style: Only for factual intents)
            const isFactualIntent = ['JOB_SEARCH', 'JOB_DETAILS', 'FIELD_DETAILS', 'APPLICATION_HELP', 'SCHOLARSHIP'].includes(plan.mode || plan.intent);
            const dataIsMissing = !knowledgeContext.jobs && !knowledgeContext.web;
            if (plan.behavior !== 'CLARIFY' && dataIsMissing && isFactualIntent) {
                systemInstruction += "\n\nNOTE: No specific live records were found. Do not just say 'Maaf kijiye'. Instead, provide general guidance about the query, explain the typical eligibility or process, and advise the user to check official portals. Be helpful and conversational like a friend.";
            }

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');
            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;
            const safeHistory = this._sanitizeHistory(history, profile);

            let aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. Only discuss jobs active in ${currentYear} or later.` },
                ...safeHistory,
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
                    ...safeHistory,
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
            } else if (!validation.passed && validation.shouldRetryLLM && this._isFactualJobMode(plan) && !this._hasVerifiedData(knowledgeContext)) {
                // If no verified DB/search source exists, never let a repaired or raw
                // LLM answer invent vacancies, dates, fees, or links.
                finalContent = this._safeNoDataResponse(rawInput);
            }

            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(finalContent, confidence, {
                intent: plan.intent || resolvedIntent.primaryIntent,
                query: rewrittenQuery,
                isPureGreeting: validationInput.isPureGreeting,
                userProfile: profile,
                plan,
                knowledgeContext,
                aiSuggestions: resolvedIntent.suggestions // Neural suggestions from LLM
            });

            // PHASE 6: Extract Memory Insights (Fire & Forget for speed, or await for consistency)
            const memoryUpdate = await MemoryManager.extractInsights(rawInput, processed.message, state.insights);
            const updatedInsights = this._mergeInsightsWithProfile(memoryUpdate.updatedInsights, profile);

            await SessionState.update(sessionId, {
                query: rawInput,
                resolvedIntent,
                aiResponse: processed.message,
                plan,
                knowledgeContext,
                userName,
                insights: updatedInsights,
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
        if (this._isSimpleGreeting(userMessage)) {
            onChunk(Cleaner.getGreetingFallback());
            onChunk(`\n\n[METADATA]${JSON.stringify({ success: true, requestId, isFullResponse: true, suggestions: ["Latest jobs", "Career advice"] })}`);
            return;
        }

        const directConversation = this._getDirectConversationResponse(userMessage);
        if (directConversation) {
            onChunk(directConversation.message);
            onChunk(`\n\n[METADATA]${JSON.stringify({ success: true, requestId, isFullResponse: true, suggestions: directConversation.suggestions })}`);
            return;
        }

        const profileCorrection = this._getProfileCorrectionResponse(userMessage);
        if (profileCorrection) {
            await this._clearDeniedQualificationFromState(input.sessionId, userMessage);
            onChunk(profileCorrection.message);
            onChunk(`\n\n[METADATA]${JSON.stringify({ success: true, requestId, isFullResponse: true, suggestions: profileCorrection.suggestions })}`);
            return;
        }

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

            // --- SYNC POINT: Ensure Profile (Source of Truth) overrides Memory (Insights) ---
            state.insights = this._mergeInsightsWithProfile(state.insights, profile);

            const resolvedIntent = await IntentEngine.classify(rawInput, state, profile);
            const deniedQualification = this._getDeniedQualification(rawInput);
            // The neural intent engine is the source of truth in this architecture.
            // Keep the old state shape without depending on the removed RuleDetector.
            const intentObj = {
                acts: [resolvedIntent.communicationAct || resolvedIntent.discourse || 'QUESTION'],
                domains: [resolvedIntent.domain || resolvedIntent.domainIntent || 'GENERAL'],
                intents: [resolvedIntent.primaryIntent || 'GENERAL_QUERY']
            };

            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                const safeEntities = { ...resolvedIntent.entities };
                if (deniedQualification && safeEntities.qualification) {
                    delete safeEntities.qualification;
                }
                await UserProfile.syncToDb(userName, safeEntities);
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

                // Streaming uses the same factual safety policy as non-streaming:
                // if DB has no job data, try verified web search before falling back.
                const dataIsMissing = (!dbResult || !dbResult.jobs) && !webData;
                const isFactualNeed = ['JOB_SEARCH', 'JOB_DETAILS'].includes(plan.mode);
                if (dataIsMissing && isFactualNeed) {
                    webData = await this._fetchWebKnowledge(searchQuery);
                }

                if (dbResult && dbResult.jobs) knowledgeContext.jobs = dbResult.jobs;
                if (webData) knowledgeContext.web = webData;
            }

            const options = { timeZone: "Asia/Kolkata", day: '2-digit', month: 'long', year: 'numeric' };
            const indiaDateStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());
            const currentYear = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", year: 'numeric' });

            const promptMeta = { currentDate: indiaDateStr, currentYear, sessionId, behavior: plan.behavior, turnCount: state.turnCount || 0, plan };
            let systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            const llm = await this._getLLMProvider();
            const safeHistory = this._sanitizeHistory(history, profile);

            let fullContent = "";
            await llm.chatStream([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. Only discuss jobs active in ${currentYear} or later.` },
                ...safeHistory,
                { role: 'user', content: searchQuery }
            ], (chunk) => {
                // Do not stream unvalidated factual answers. The UI appends chunks,
                // so sending a later fallback would visibly concatenate wrong data.
                fullContent += chunk;
            });

            const validationInput = { query: searchQuery, liveData: knowledgeContext, intent: plan.intent, userProfile: profile, isPureGreeting: plan.isPureGreeting || plan.behavior === 'GREET', resolvedIntent, state, plan };
            const validation = Validator.validate(fullContent, validationInput);
            if (!validation.passed && validation.shouldRetryLLM && this._isFactualJobMode(plan) && !this._hasVerifiedData(knowledgeContext)) {
                fullContent = this._safeNoDataResponse(rawInput);
            }

            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(fullContent, confidence, {
                intent: plan.intent || resolvedIntent.primaryIntent,
                query: searchQuery,
                userProfile: profile,
                plan: plan,
                knowledgeContext: knowledgeContext
            });

            onChunk(processed.message);

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
        const reranked = await SearchReranker.rank(query, results);

        return reranked.map((r, i) => `SOURCE ${i + 1}: [TITLE: ${r.title}] [URL: ${r.url}] [SNIPPET: ${r.snippet}]`).join("\n");
    }

    static _isSimpleGreeting(message = "") {
        const clean = String(message).toLowerCase().replace(/[?.!]/g, '').replace(/\s+/g, ' ').trim();
        // More robust greeting detection: checks for core greeting words alone or with "bhai/jobo/aap"
        const coreGreetings = ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'ram ram', 'kaise ho', 'kya haal hai', 'halo', 'hii'];
        const isCoreMatch = coreGreetings.some(g => clean === g || clean.startsWith(g + ' ') || clean.endsWith(' ' + g));
        const isJoboMention = clean.includes('jobo') || clean.includes('bhai') || clean.includes('aap');

        // Match simple greetings like "hi jobo", "kaise ho bhai", "namaste aap kaise ho"
        return isCoreMatch && clean.split(' ').length <= 4;
    }

    static _getDirectConversationResponse(message = "") {
        const clean = String(message).toLowerCase().replace(/[?.!]/g, '').replace(/\s+/g, ' ').trim();

        // Personal questions about the assistant are conversational intent, not
        // job/career intent. Answer them directly so the user feels heard.
        if (/\b(kaha|kha|kidhar|where)\b.*\b(rahte|rehte|rehta|rhte|se|from|live)\b/.test(clean)) {
            return {
                message: "Main physical jagah par nahi rehta, bhai. Main cloud/server par chalne wala Jobo AI hoon, aur yahin app me aapki jobs, career aur forms me help karta hoon.",
                suggestions: ["Latest jobs", "Career advice", "Resume help"]
            };
        }

        if (/\b(tum|aap|ap|jobo)\b.*\b(kaun|kon|who)\b|\b(kaun ho|kon ho|who are you)\b/.test(clean)) {
            return {
                message: "Main Jobo AI hoon, aapka career dost. Main job details, eligibility, forms, resume aur career guidance me help karta hoon.",
                suggestions: ["Latest jobs", "Eligibility check", "Career advice"]
            };
        }

        if (/\b(tum|aap|ap|jobo)\b.*\b(kya karte|kya kar sakte|help|madad)\b/.test(clean)) {
            return {
                message: "Main aapko sarkari/private jobs samjhane, eligibility check karne, form steps batane, resume aur career planning me help kar sakta hoon.",
                suggestions: ["Latest jobs", "Form kaise bhare", "Resume help"]
            };
        }

        return null;
    }

    static _getProfileCorrectionResponse(message = "") {
        const denied = this._getDeniedQualification(message);
        if (!denied) return null;

        const label = denied === '12th' ? '12th pass' : denied === '10th' ? '10th pass' : 'graduate';
        return {
            message: `Samajh gaya bhai, aap ${label} nahi ho. Main is purani baat ko answer me use nahi karunga. Aap apni current qualification bata do, main uske hisaab se jobs/career options suggest kar dunga.`,
            suggestions: ["Graduate jobs", "Qualification update", "Latest jobs"]
        };
    }

    static _isFactualJobMode(plan = {}) {
        return ['JOB_SEARCH', 'JOB_DETAILS', 'MORE_RESULTS', 'RESULT'].includes(plan.mode);
    }

    static _hasVerifiedData(knowledgeContext = {}) {
        return Boolean(
            (knowledgeContext.jobs && knowledgeContext.jobs.trim()) ||
            (knowledgeContext.web && knowledgeContext.web.trim())
        );
    }

    static _safeNoDataResponse(query = "") {
        const q = String(query).toLowerCase();
        if (q.includes('job') || q.includes('naukri') || q.includes('bharti') || q.includes('vacancy')) {
            return "Maaf kijiye bhai, abhi mere verified database mein isse related koi active job update nahi mil raha hai. Main galat jankari nahi dena chahta. Aap official websites check kar sakte hain ya fir kisi specific category (Jaise: Railway, Police, SSC) ke baare mein puch sakte hain.";
        }

        return semanticSafeFallback(query);
    }

    static _mergeInsightsWithProfile(insights = {}, profile = {}) {
        const merged = { ...(insights || {}) };

        // Current user profile is authoritative over conversational memory.
        // Memory may fill missing fields, but cannot downgrade Graduate to 12th.
        if (profile.qualification) merged.qualification = profile.qualification;
        if (profile.state) merged.location = profile.state;
        if (profile.category) merged.category = profile.category;
        if (profile.dob) merged.dob = profile.dob;

        return merged;
    }

    static _getDeniedQualification(message = "") {
        const clean = String(message).toLowerCase().replace(/[?.!]/g, '').replace(/\s+/g, ' ').trim();
        const denial = /\b(nahi|nhi|nahin|not)\b/;

        if (/\b(12th|12वीं|barahvi|intermediate)\b/i.test(clean) && denial.test(clean)) return '12th';
        if (/\b(10th|10वीं|dasvi|high school)\b/i.test(clean) && denial.test(clean)) return '10th';
        if (/\b(graduate|graduation|bachelor|degree|bsc|bcom|ba)\b/i.test(clean) && denial.test(clean)) return 'graduate';

        return null;
    }

    static async _clearDeniedQualificationFromState(sessionId, message = "") {
        const denied = this._getDeniedQualification(message);
        if (!sessionId || !denied) return;

        try {
            const state = await SessionState.get(sessionId);
            const insights = { ...(state.insights || {}) };
            if (String(insights.qualification || '').toLowerCase().includes(denied)) {
                delete insights.qualification;
                await StateModel.findOneAndUpdate(
                    { sessionId },
                    { insights, updatedAt: Date.now() },
                    { new: true }
                );
            }
        } catch (error) {
            console.warn('Profile correction memory cleanup failed:', error.message);
        }
    }

    static _sanitizeHistory(history = [], profile = {}) {
        if (!Array.isArray(history) || !profile.qualification) return history || [];

        const qualification = String(profile.qualification).toLowerCase();
        const profileIs12th = /\b12th\b|\b12वीं\b|\bbarahvi\b|\bintermediate\b/i.test(qualification);
        if (profileIs12th) return history;

        return history.map(item => {
            if (item?.role !== 'assistant' || typeof item.content !== 'string') return item;

            const content = item.content
                .split('\n')
                .filter(line => !/\baap\s+(12th|12वीं|barahvi|intermediate)\s+pass\s+ho\b/i.test(line))
                .join('\n')
                .trim();

            return { ...item, content };
        });
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
