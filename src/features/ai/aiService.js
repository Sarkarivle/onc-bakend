const Chat = require('../chat/chatModel');
const Feedback = require('../feedback/feedbackModel');
const {
    normalizeRequest,
    preLlmChecks,
    postLlmFilter,
    shapeResponse,
    SAFE_RESPONSES,
    semanticSafeFallback
} = require('./brain/aiSafetyGuard');
const Settings = require('../settings/settingsModel');
const Job = require('../jobs/jobModel');
const Jansewa = require('../jansewa/jansewaModel');
const constants = require('../../config/constants');

// Pipeline Modules
const IntentDetector = require('./intentDetector');
const ConversationState = require('./conversationState');
const UserProfile = require('./userProfile');
const QueryRewriter = require('./queryRewriter');
const Planner = require('./planner');
const KnowledgeRouter = require('./knowledgeRouter');
const PromptComposer = require('./promptComposer');
const SearchService = require('./searchService');
const ResponseValidator = require('./responseValidator');
const ResponseCleaner = require('./responseCleaner');
const ResponseFormatter = require('./responseFormatter');
const ConfidenceEngine = require('./confidenceEngine');
const SuggestionEngine = require('./suggestionEngine');
const ProgressEmitter = require('./progressEmitter');
const cheerio = require('cheerio');

// Infrastructure Layers
const RunpodProvider = require('./providers/runpodProvider');
const Metrics = require('./observability/metrics');
const SearchReranker = require('./searchReranker');
const EmbeddingService = require('./embeddingService');

class AIService {
    /**
     * Enterprise AI Orchestrator (Phase 1-12)
     */
    static async processRequest(input) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // PHASE 6-B: Pre-LLM Safety Gate Integration
        const userMessage = normalizeRequest(input);
        const preCheckResponse = preLlmChecks(userMessage, input);
        if (preCheckResponse) {
            return { ...preCheckResponse, requestId };
        }

        const { userName, history } = input;
        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = userMessage; // Already normalized

        ProgressEmitter.emit(sessionId, 'REQUEST_RECEIVED');
        ProgressEmitter.emit(sessionId, 'INPUT_PROCESSING');

        let metrics = { intent: 'UNKNOWN', provider: 'NONE', searchUsed: false, requestId };

        try {
            // --- PHASE 3: Context Acquisition ---
            ProgressEmitter.emit(sessionId, 'CONVERSATION_STATE_LOADING');
            const [state, profile] = await Promise.all([
                ConversationState.get(sessionId),
                UserProfile.get(userName, input)
            ]);
            ProgressEmitter.emit(sessionId, 'USER_PROFILE_LOADING');

            // --- PHASE 4: Intent Resolution ---
            ProgressEmitter.emit(sessionId, 'INTENT_DETECTION');
            // Upgrade: Passing last response content for better follow-up resolution
            const resolvedIntent = await IntentDetector.detectSemantic(rawInput, {
                ...state,
                lastAssistantResponse: state.aiResponse || ""
            }, profile);
            const intentObj = IntentDetector.detect(rawInput); // Legacy fallback context

            // --- PHASE 4-B: Profile Sync ---
            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                await UserProfile.syncToDb(userName, {
                    qualification: resolvedIntent.entities.qualification,
                    state: resolvedIntent.entities.location || resolvedIntent.entities.state,
                    category: resolvedIntent.entities.category,
                    dob: resolvedIntent.entities.dob,
                    gender: resolvedIntent.entities.gender
                });
            }

            // --- PHASE 5: Planning ---
            ProgressEmitter.emit(sessionId, 'PLANNING');
            const plan = Planner.plan(rawInput, resolvedIntent, state, profile);
            metrics.intent = plan.intent;

            // --- PHASE 6: Knowledge Routing ---            
            let queryForSearch = resolvedIntent.isFollowUp ? (resolvedIntent.normalizedMessage || rawInput) : rawInput;

            // If we have specific field details intent, make search more targeted
            const isContextualFollowup = resolvedIntent.isFollowUp && state.topic && state.topic !== 'GENERAL';
            if (isContextualFollowup && ['FIELD_DETAILS', 'APPLICATION_HELP'].includes(resolvedIntent.primaryIntent)) {
                queryForSearch = `${plan.referencedItem || state.topic} ${rawInput}`;
            }

            const rewrittenQuery = QueryRewriter.rewrite(queryForSearch, state);
            const routes = KnowledgeRouter.route(plan, rewrittenQuery);

            // --- PHASE 7: Data Collection ---
            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile), referencedItem: plan.referencedItem };
            if (routes.isFactualQuery || plan.behavior === 'PROCESS_INPUT' || plan.intent === 'GOVT_JOB') {
                if (routes.selectedSources.includes('DATABASE')) ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');

                let searchQuery = (rawInput.length < 5 && state.lastDomain !== 'GENERAL') ? state.lastDomain : rewrittenQuery;

                // Improved follow-up search: If query is very short (e.g., "batao", "dikhao"), use the topic
                const isShortQuery = rawInput.length < 10 && (rawInput.includes('batao') || rawInput.includes('dikhao') || rawInput.includes('jobs'));
                if (isShortQuery && state.topic && state.topic !== 'GENERAL') {
                    searchQuery = state.topic + " " + rawInput;
                }

                let [dbResult, webData] = await Promise.all([
                    this._fetchDatabaseKnowledge(searchQuery, profile, plan),
                    routes.selectedSources.includes('SEARCH') ? this._fetchWebKnowledge(searchQuery) : null
                ]);

                if (dbResult && dbResult.jobs) knowledgeContext.jobs = dbResult.jobs;

                // Fallback to search if DB is empty and router allows it
                if (!knowledgeContext.jobs && routes.shouldCheckSearchIfDbFails && !webData) {
                    ProgressEmitter.emit(sessionId, 'WEB_SEARCHING');
                    webData = await this._fetchWebKnowledge(searchQuery);
                }

                if (webData) knowledgeContext.web = webData;
            }

            // --- PHASE 8 & 9: LLM Execution ---
            ProgressEmitter.emit(sessionId, 'PROMPT_COMPOSING');

            // Get Current Date in Kolkata Timezone (IST)
            const options = { timeZone: "Asia/Kolkata", day: '2-digit', month: 'long', year: 'numeric' };
            const indiaDateStr = new Intl.DateTimeFormat('en-GB', options).format(new Date());
            const currentYear = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", year: 'numeric' });

            const promptMeta = {
                currentDate: indiaDateStr,
                currentYear: currentYear,
                sessionId,
                behavior: plan.behavior,
                turnCount: state.turnCount || 0,
                plan: plan
            };

            let systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            // CLARIFY behavior handling (New Upgrade)
            if (plan.behavior === 'CLARIFY') {
                systemInstruction += "\n\nCRITICAL: The user's query is too short or ambiguous. Do not guess. Politely ask them to explain their question in detail using the template in your personality module.";
            }

            // Flexible fallback for missing data
            if (plan.behavior !== 'CLARIFY' && !knowledgeContext.jobs && !knowledgeContext.web && plan.intent !== 'GENERAL') {
                systemInstruction += "\n\nNOTE: No specific live job records were found in the private database. Do not just say 'Maaf kijiye'. Instead, provide general guidance about the query, explain the typical eligibility or process, and advise the user to check official portals like SSC/RRB for the most recent updates. Be helpful and conversational like a friend.";
            }

            // Specific follow-up prompt injection
            if (plan.intent === 'APPLICATION_HELP') {
                systemInstruction += `\n\nCRITICAL: The user is asking how to apply. Provide a step-by-step guide for the job "${plan.referencedItem || state.topic}". The steps MUST include: opening the official link/notification, registration, filling the form, uploading documents, paying fees if applicable, final submission, and printing/saving the confirmation.`;
            } else if (plan.intent === 'FIELD_DETAILS') {
                const field = resolvedIntent.entities?.field || '';
                if (field === 'fees') {
                    systemInstruction += `\n\nCRITICAL: The user is asking about fees for "${plan.referencedItem || state.topic}". If fee details are in the context, state them clearly. If not, you MUST respond that fee details should be checked on the official notification. Do not invent a fee.`;
                } else if (field === 'link') {
                    systemInstruction += `\n\nCRITICAL: The user is asking for the official link for "${plan.referencedItem || state.topic}". If a link is in the context, provide it. If not, you MUST respond that the official link is not currently available or to check the official website. Do not invent a link.`;
                }
            }

            if (plan.selectedItemIndex && plan.referencedItem) {
                systemInstruction += `\n\nCRITICAL: The user has selected item number ${plan.selectedItemIndex}. Your response MUST be about "${plan.referencedItem}". Start your response by mentioning the selected item's title.`;
            }

            // Eligibility Test Vacancy Handling (Issue 4)
            const isEligibilityTest = (plan.referencedItem || state.topic) && /(tet|jhtet|ctet|eligibility test)/i.test(plan.referencedItem || state.topic);
            if (isEligibilityTest && resolvedIntent.primaryIntent === 'FIELD_DETAILS' && /vacancy|post|seat/i.test(rawInput)) {
                systemInstruction += `\n\nCRITICAL: The user is asking for vacancy count for an eligibility test. You MUST respond with this exact phrase structure: "${plan.referencedItem || 'Ye'} ek eligibility test hai, not a direct vacancy. Isliye vacancy count directly apply nahi hota. Teaching vacancies separately check ki ja sakti hain." Do not invent a number.`;
            }

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');

            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            let aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. The current year is ${currentYear}. Only discuss jobs active in ${currentYear} or later. Disregard any internal knowledge of previous years.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            let llmContent = aiResponse.content;

            // --- PHASE 9-B: Dynamic Tool Looping (Mid-Conversation Thinking) ---
            const toolCallMatch = llmContent.match(/CALL_TOOL:\s*(DATABASE|SEARCH)\("(.*?)"\)/i);
            if (toolCallMatch) {
                const toolType = toolCallMatch[1].toUpperCase();
                const toolQuery = toolCallMatch[2];
                ProgressEmitter.emit(sessionId, `DYNAMIC_${toolType}_CALLING`);

                let additionalData = "";
                if (toolType === 'DATABASE') {
                    const dbRes = await this._fetchDatabaseKnowledge(toolQuery, profile, plan);
                    additionalData = dbRes.jobs;
                } else if (toolType === 'SEARCH') {
                    additionalData = await this._fetchWebKnowledge(toolQuery);
                }

                if (additionalData) {
                    ProgressEmitter.emit(sessionId, 'LLM_RE_THINKING');
                    const secondResponse = await llm.chat([
                        { role: 'system', content: systemInstruction },
                        ...(history || []),
                        { role: 'user', content: rewrittenQuery },
                        { role: 'assistant', content: llmContent },
                        { role: 'system', content: `[ADDITIONAL ${toolType} DATA]: ${additionalData}\n\nNow, finalize your response based on this new information.` }
                    ]);
                    llmContent = secondResponse.content;
                }
            }

            // --- PHASE 10: Validation & Self-Critique Loop (Gemini-like) ---
            ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');

            const validationInput = {
                query: rewrittenQuery,
                liveData: knowledgeContext,
                intent: plan.intent,
                userProfile: profile,
                isPureGreeting: plan.isPureGreeting || plan.behavior === 'GREET',
                resolvedIntent: resolvedIntent,
                state: state,
                plan: plan
            };

            let validation = ResponseValidator.validate(llmContent, validationInput);
            let retryCount = 0;
            const MAX_RETRIES = 2;

            while (!validation.passed && retryCount < MAX_RETRIES) {
                if (validation.shouldRetryLLM) {
                    retryCount++;
                    ProgressEmitter.emit(sessionId, `LLM_SELF_CORRECTING_V${retryCount}`);

                    const critiquePrompt = `
[SELF-CRITIQUE MODE]
Your previous response had the following issues:
${validation.issues.map(iss => `- ${iss}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. Re-read the [REAL-TIME DATA SOURCE] carefully.
2. Remove any facts, dates, or numbers NOT found in the source.
3. Fix any internal leakage (never mention "database", "intent", "rules").
4. Rewrite the response to be 100% accurate and professional.
5. Wrap your NEW response in <USER_MESSAGE> tags.
`;
                    const repairResponse = await llm.chat([
                        { role: 'system', content: systemInstruction },
                        ...(history || []),
                        { role: 'user', content: rewrittenQuery },
                        { role: 'assistant', content: llmContent },
                        { role: 'system', content: critiquePrompt }
                    ]);

                    llmContent = repairResponse.content;
                    validation = ResponseValidator.validate(llmContent, validationInput);
                } else {
                    // Low severity issues can be fixed by code cleanup
                    llmContent = ResponseCleaner.clean(llmContent, {
                        isPureGreeting: validationInput.isPureGreeting,
                        intent: plan.intent,
                        query: rewrittenQuery
                    });
                    break;
                }
            }

            // Hallucination Check for Jobs (Additional layer for extra safety)
            const isDataMissing = !knowledgeContext.jobs && !knowledgeContext.web;
            const sourceText = (knowledgeContext.jobs + " " + (knowledgeContext.web || "")).toLowerCase();
            let hasHallucinatedJob = false;
            if (plan.intent === 'GOVT_JOB' || llmContent.toLowerCase().includes('vacancy')) {
                const jobMatches = llmContent.match(/\d\.\s+\*\*(.*?)\*\*/g);
                if (jobMatches && isDataMissing) {
                    hasHallucinatedJob = true;
                } else if (/\d{2,}/.test(llmContent) && isDataMissing) {
                    hasHallucinatedJob = true;
                }
            }

            // PHASE 6-B: Post-LLM Safety Filter
            let finalContent = postLlmFilter(llmContent, rawInput);

            // Fallback for missing verified data (Phase 6-D)
            const isCriticalIntent = ['GOVT_JOB', 'CAREER', 'SCHOLARSHIP'].includes(plan.intent);
            if (isDataMissing && isCriticalIntent) {
                // Use semantic fallback if validation failed, hallucination detected, or LLM gave generic response
                if (!validation.passed || hasHallucinatedJob || finalContent.includes("verified jankari nahi") || finalContent === SAFE_RESPONSES.GENERIC_FALLBACK) {
                    finalContent = semanticSafeFallback(rawInput);
                    // Ensure the fallback itself passes safety
                    finalContent = postLlmFilter(finalContent, rawInput);
                }
            } else if (!validation.passed && validationInput.isPureGreeting) {
                finalContent = ResponseCleaner.getGreetingFallback();
            }

            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(finalContent, confidence, {
                intent: plan.intent,
                query: rewrittenQuery,
                isPureGreeting: validationInput.isPureGreeting,
                userProfile: profile,
                plan: plan,
                knowledgeContext: knowledgeContext
            });

            // --- PHASE 11 & 12: Analytics & State Sync ---
            await ConversationState.update(sessionId, {
                query: rawInput,
                acts: intentObj.acts,
                domains: intentObj.domains,
                intents: intentObj.intents,
                resolvedIntent: resolvedIntent,
                aiResponse: processed.message,
                plan: plan,
                knowledgeContext: knowledgeContext,
                validation: validation
            });

            metrics.latency = Date.now() - startTime;
            Metrics.logRequest(metrics);
            await this._persistChat(userName, sessionId, rawInput, processed, metrics, state.topic);

            // PHASE 6-B: Final shaping of the response
            const { message, ...extraFields } = processed;
            const finalResponse = shapeResponse(message, extraFields);

            ProgressEmitter.emit(sessionId, 'FINAL_RESPONSE_READY');

            return { ...finalResponse, confidence: confidence.score, topic: state.topic, requestId };

        } catch (error) {
            ProgressEmitter.emit(sessionId, 'ERROR');
            metrics.error = error.message;
            Metrics.logRequest(metrics);
            console.error("❌ Orchestration Error:", error);
            return { ...shapeResponse(SAFE_RESPONSES.GENERIC_FALLBACK), success: false, requestId };
        }
    }

    static async processRequestStream(input, onChunk) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const userMessage = normalizeRequest(input);
        const preCheckResponse = preLlmChecks(userMessage, input);
        if (preCheckResponse) {
            onChunk(preCheckResponse.message); // Send text first
            onChunk(`\n\n[METADATA]${JSON.stringify({ ...preCheckResponse, requestId, isFullResponse: true, suggestions: ["Sarkari Naukri", "Career Advice", "Resume Help"] })}`);
            return;
        }

        const { userName, history } = input;
        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = userMessage;

        try {
            const [state, profile] = await Promise.all([
                ConversationState.get(sessionId),
                UserProfile.get(userName, input)
            ]);

            const resolvedIntent = await IntentDetector.detectSemantic(rawInput, state, profile);
            const intentObj = IntentDetector.detect(rawInput);

            // --- Profile Sync ---
            if (resolvedIntent.entities && Object.keys(resolvedIntent.entities).length > 0) {
                await UserProfile.syncToDb(userName, {
                    qualification: resolvedIntent.entities.qualification,
                    state: resolvedIntent.entities.location || resolvedIntent.entities.state,
                    category: resolvedIntent.entities.category,
                    dob: resolvedIntent.entities.dob,
                    gender: resolvedIntent.entities.gender
                });
            }

            const plan = Planner.plan(rawInput, resolvedIntent, state, profile);

            let queryForSearch = resolvedIntent.isFollowUp ? (resolvedIntent.normalizedMessage || rawInput) : rawInput;
            const rewrittenQuery = QueryRewriter.rewrite(queryForSearch, state);
            const routes = KnowledgeRouter.route(plan, rewrittenQuery);

            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile), referencedItem: plan.referencedItem };
            if (routes.isFactualQuery || plan.behavior === 'PROCESS_INPUT' || plan.intent === 'GOVT_JOB') {
                let [dbResult, webData] = await Promise.all([
                    this._fetchDatabaseKnowledge(rewrittenQuery, profile, plan),
                    routes.selectedSources.includes('SEARCH') ? this._fetchWebKnowledge(rewrittenQuery) : null
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
            const streamResponse = await llm.chatStream([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. Only discuss jobs active in ${currentYear} or later.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ], (chunk) => {
                fullContent += chunk;
                onChunk(chunk); // Send raw chunk to UI
            });

            // Post-stream processing
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, { passed: true });
            const processed = this._finalProcess(fullContent, confidence, {
                intent: plan.intent,
                query: rewrittenQuery,
                userProfile: profile
            });

            await ConversationState.update(sessionId, {
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

            // Final metadata chunk
            onChunk(`\n\n[METADATA]${JSON.stringify({
                confidence: confidence.score,
                topic: state.topic,
                requestId,
                suggestions: processed.suggestions
            })}`);

        } catch (error) {
            console.error("❌ Streaming Orchestration Error:", error);
            onChunk(SAFE_RESPONSES.GENERIC_FALLBACK);
        }
    }

    static async _getLLMProvider() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        return new RunpodProvider({ baseUrl: (setting?.value || constants.DEFAULT_RUNPOD_URL).replace(/\/$/, '') + '/api/chat', model: constants.AI_MODEL_NAME });
    }

    static async _fetchDatabaseKnowledge(query, profile, plan) {
        const q = query.toLowerCase();

        if (plan.referencedItem) {
            return { count: 1, jobs: `- JOB: ${plan.referencedItem}` };
        }

        // --- PHASE A: Semantic Search (Vector) ---
        const queryVector = await EmbeddingService.generate(query);
        if (queryVector) {
            try {
                const vectorJobs = await Job.aggregate([
                    {
                        $vectorSearch: {
                            index: "vector_index",
                            path: "searchVector",
                            queryVector: queryVector,
                            numCandidates: 100,
                            limit: 10
                        }
                    },
                    { $match: { isActive: true } }
                ]);

                if (vectorJobs.length > 0) {
                    return {
                        count: vectorJobs.length,
                        jobs: vectorJobs.map(j => this._formatJobForContext(j)).join("\n")
                    };
                }
            } catch (err) {
                console.warn("⚠️ Vector Search failed or index missing:", err.message);
            }
        }

        // --- PHASE B: Keyword Search (Fallback) ---
        const isGeneric = q.includes('top') || q.includes('latest') || q.includes('active') || q.includes('job') || q.includes('vacancy') || q.includes('bharti') || q.includes('data') || q.includes('database');

        const keywords = q.split(/\s+/).filter(w => w.length > 2 && !['jobs', 'bharti', 'vacancy', 'list', 'kaunsi', 'batayein', 'dikhao', 'karein', 'kijiye', 'bare', 'mein', 'data', 'database'].includes(w));

        const now = new Date();
        let criteria = {
            isActive: true,
            $or: [
                { lastDate: { $gte: now } },
                { lastDate: null },
                { lastDate: { $exists: false } }
            ]
        };

        if (!isGeneric && keywords.length > 0) {
            criteria.$and = [
                { isActive: true },
                { $or: criteria.$or },
                {
                    $or: [
                        { title: { $regex: keywords.join('|'), $options: 'i' } },
                        { organization: { $regex: keywords.join('|'), $options: 'i' } },
                        { fullHtmlContent: { $regex: keywords.join('|'), $options: 'i' } }
                    ]
                }
            ];
            delete criteria.isActive;
            delete criteria.$or;
        }

        let jobs = [];
        if (profile?.qualification) {
            let qualCriteria = { ...criteria };
            const qualRegex = { $regex: profile.qualification, $options: 'i' };
            if (qualCriteria.$and) {
                qualCriteria.$and.push({ 'eligibility.education': qualRegex });
            } else {
                qualCriteria['eligibility.education'] = qualRegex;
            }
            jobs = await Job.find(qualCriteria).sort({ createdAt: -1 }).limit(10);
        }

        if (jobs.length === 0) {
            let sortCriteria = { lastDate: 1 };
            if (q.includes('new') || q.includes('latest') || q.includes('fresh') || isGeneric) {
                sortCriteria = { createdAt: -1 };
            }
            jobs = await Job.find(criteria).sort(sortCriteria).limit(10);
        }

        return {
            count: jobs.length,
            jobs: jobs.length > 0 ? jobs.map(j => this._formatJobForContext(j)).join("\n") : ""
        };
    }

    static _formatJobForContext(j) {
        let title = j.title;
        let org = j.organization || "N/A";
        let htmlDetails = "";

        if (j.fullHtmlContent) {
            const $ = cheerio.load(j.fullHtmlContent);
            if (!title || title === "N/A") {
                title = $('h1, h2, h3, b, strong').first().text().trim().substring(0, 100);
            }
            $('script, style, nav, footer').remove();
            htmlDetails = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 600);
        }

        let info = `- JOB: ${title || "N/A"} | Org: ${org} | Vacancy: ${j.totalVacancy || "N/A"} | Last Date: ${j.importantDates?.applicationLastDate || "Check Site"}`;
        if (htmlDetails) info += ` | Summary: ${htmlDetails}...`;
        if (j.eligibility?.education) info += ` | Qualification: ${j.eligibility.education}`;

        return info;
    }

    static async _fetchWebKnowledge(query) {
        const [key, cx] = await Promise.all([
            Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }),
            Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })
        ]);

        const apiKey = key?.value || "AIzaSyDCOXTGWVsKdayMwQHT6f1NxZivfUSPg-A";
        const cxId = cx?.value || "b5a3e21452b44a41e0";

        if (!apiKey) return "";

        const results = await SearchService.search(query, apiKey, cxId);
        const reranked = SearchReranker.rank(query, results);

        if (!reranked || reranked.length === 0) return "";

        // Format search results into a readable string for the LLM
        return reranked.map((r, i) =>
            `SOURCE ${i + 1}: [TITLE: ${r.title}] [URL: ${r.url}] [SNIPPET: ${r.snippet}]`
        ).join("\n");
    }

    static _finalProcess(content, confidence, meta = {}) {
        // 1. Extract Agent Thought & User Message
        const thoughtMatch = content.match(/<AGENT_THOUGHT>([\s\S]*?)<\/AGENT_THOUGHT>/i);
        const userMsgMatch = content.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);

        // If <USER_MESSAGE> is missing, use the content after </AGENT_THOUGHT> or the whole thing
        let message = userMsgMatch ? userMsgMatch[1].trim() : content.replace(/<AGENT_THOUGHT>[\s\S]*?<\/AGENT_THOUGHT>/i, '').trim();

        // 2. Code-based Cleaning
        message = ResponseCleaner.clean(message, meta);

        // 3. Formatting & Polish
        message = ResponseFormatter.format(message, meta);

        // 4. Dynamic Suggestions (Gemini-style)
        const suggestMatch = content.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i);
        const aiSuggestions = suggestMatch ? suggestMatch[1].split(',').map(s => s.trim()) : [];
        const suggestions = SuggestionEngine.generate(meta.plan, meta.knowledgeContext, aiSuggestions);

        // Legacy/Math support
        const mathMatch = content.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);

        return {
            message,
            thought: thoughtMatch ? thoughtMatch[1].trim() : "",
            calculation: mathMatch ? mathMatch[1].trim() : "",
            suggestions
        };
    }

    static _stripEligibilityLines(message) {
        const lines = message.split('\n');
        const cleaned = [];
        let skippingEligibility = false;
        const eligibilityStart = /^\s*-?\s*(eligibility|eligiblity|qualification|educational qualification|education requirement|age limit)\s*:/i;
        const nextAllowedLine = /^\s*(\d+\.\s+|-+\s*(vacancy|last date|official link|apply link)\s*:|pro tip\s*:|kaunsi\b|kya\b|apply se\b)/i;

        for (const line of lines) {
            if (eligibilityStart.test(line)) {
                skippingEligibility = true;
                continue;
            }

            if (skippingEligibility) {
                if (!line.trim()) {
                    skippingEligibility = false;
                    cleaned.push(line);
                    continue;
                }

                if (!nextAllowedLine.test(line)) {
                    continue;
                }

                skippingEligibility = false;
            }

            cleaned.push(line);
        }

        return cleaned.join('\n');
    }

    static async _persistChat(user, session, input, processed, metrics, topic) {
        if (!user || !processed.message) return;
        await Promise.all([
            Chat.create({ userName: user, sessionId: session, role: 'user', content: input }),
            Chat.create({
                userName: user,
                sessionId: session,
                role: 'assistant',
                content: processed.message,
                thought: processed.thought,
                calculation: processed.calculation,
                suggestions: processed.suggestions,
                metadata: { confidence: metrics.confidence, topic }
            })
        ]);
    }
}

module.exports = AIService;
