const Chat = require('../chat/chatModel');
const Feedback = require('../feedback/feedbackModel');
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
const ProgressEmitter = require('./progressEmitter');
const cheerio = require('cheerio');

// Infrastructure Layers
const RunpodProvider = require('./providers/runpodProvider');
const Metrics = require('./observability/metrics');
const SearchReranker = require('./searchReranker');

class AIService {
    /**
     * Enterprise AI Orchestrator (Phase 1-12)
     */
    static async processRequest(input) {
        const startTime = Date.now();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const { userMessage, question, userName, history } = input;

        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = (userMessage || question || "").trim();

        ProgressEmitter.emit(sessionId, 'REQUEST_RECEIVED');

        if (!rawInput) return { success: false, message: "Empty input.", requestId };

        ProgressEmitter.emit(sessionId, 'INPUT_PROCESSING');

        let metrics = { intent: 'UNKNOWN', provider: 'NONE', searchUsed: false, requestId };

        try {
            // --- PHASE 3: Context Acquisition ---
            ProgressEmitter.emit(sessionId, 'CONVERSATION_STATE_LOADING');
            const [state, profile] = await Promise.all([
                ConversationState.get(sessionId),
                Promise.resolve(UserProfile.format({ name: userName, ...input }))
            ]);
            ProgressEmitter.emit(sessionId, 'USER_PROFILE_LOADING');

            // --- PHASE 4: Intent Resolution ---
            ProgressEmitter.emit(sessionId, 'INTENT_DETECTION');
            const resolvedIntent = await IntentDetector.detectSemantic(rawInput, state, profile);
            const intentObj = IntentDetector.detect(rawInput); // Legacy fallback context

            // --- PHASE 5: Planning ---
            ProgressEmitter.emit(sessionId, 'PLANNING');
            const plan = Planner.plan(rawInput, resolvedIntent, state, profile);
            metrics.intent = plan.intent;

            // --- PHASE 6: Knowledge Routing ---
            let queryForSearch = resolvedIntent.isFollowUp ? (resolvedIntent.resolvedQuery || rawInput) : rawInput;

            // If we have specific field details intent, make search more targeted
            if (resolvedIntent.primaryIntent === 'FIELD_DETAILS' && state.topic) {
                queryForSearch = `${state.topic} ${rawInput}`;
            }
            if (plan.referencedItem && ['FIELD_DETAILS', 'JOB_FEE_DETAILS', 'JOB_AGE_LIMIT', 'JOB_LINK_DETAILS', 'APPLICATION_HELP', 'SHOW_FULL_DETAILS'].includes(plan.intent)) {
                queryForSearch = `${plan.referencedItem} ${resolvedIntent.entities?.field || rawInput}`;
            }

            const rewrittenQuery = QueryRewriter.rewrite(queryForSearch, state);
            const routes = KnowledgeRouter.route(plan, rewrittenQuery);

            // --- PHASE 7: Data Collection ---
            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile) };
            if (routes.isFactualQuery || plan.behavior === 'PROCESS_INPUT' || plan.needDatabase || plan.intent === 'GOVT_JOB') {
                if (routes.selectedSources.includes('DATABASE')) ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');

                let searchQuery = (rawInput.length < 5 && state.lastDomain !== 'GENERAL') ? state.lastDomain : rewrittenQuery;
                if (routes.usePreviousContext && plan.referencedItem) {
                    searchQuery = `${plan.referencedItem} ${resolvedIntent.entities?.field || rewrittenQuery}`;
                }

                // Improved follow-up search: If query is very short (e.g., "batao", "dikhao"), use the topic
                const isShortQuery = rawInput.length < 10 && (rawInput.includes('batao') || rawInput.includes('dikhao') || rawInput.includes('jobs'));
                if (isShortQuery && state.topic && state.topic !== 'GENERAL') {
                    searchQuery = state.topic + " " + rawInput;
                }

                let [dbResult, webData] = await Promise.all([
                    this._fetchDatabaseKnowledge(searchQuery, profile, { pagination: routes.pagination }),
                    routes.selectedSources.includes('SEARCH') ? this._fetchWebKnowledge(searchQuery) : null
                ]);

                if (dbResult && dbResult.jobs) {
                    knowledgeContext.jobs = dbResult.jobs;
                    knowledgeContext.count = dbResult.count || 0;
                }

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

            // Add strict constraint if no live data is available
            const requiresVerifiedData = ['DATABASE_FIRST', 'DATABASE_ONLY', 'PREVIOUS_ITEM_DATABASE', 'OFFICIAL_SEARCH_IF_DB_FAILS', 'SEARCH_FIRST'].includes(plan.dataPolicy);
            if (plan.behavior !== 'CLARIFY' && plan.behavior !== 'GREET' && requiresVerifiedData && !knowledgeContext.jobs && !knowledgeContext.web) {
                systemInstruction += "\n\nCRITICAL: No verified job data found in [DATABASE] or [SEARCH]. You MUST NOT mention any specific jobs, dates, or vacancies. Simply state that you don't have verified info right now.";
            }

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');

            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            const aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. The current year is ${currentYear}. Only discuss jobs active in ${currentYear} or later. Disregard any internal knowledge of previous years.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            let finalContent = aiResponse.content;

            // --- PHASE 10: Validation & Repair Pipeline ---
            ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');

            const validationInput = {
                query: rewrittenQuery,
                liveData: knowledgeContext,
                intent: plan.intent,
                userProfile: profile,
                isPureGreeting: plan.isPureGreeting || plan.behavior === 'GREET',
                resolvedIntent: resolvedIntent,
                state: state
            };

            let validation = ResponseValidator.validate(finalContent, validationInput);

            // Hallucination Check for Jobs (Additional layer)
            const isDataMissing = !knowledgeContext.jobs && !knowledgeContext.web;
            const sourceText = (knowledgeContext.jobs + " " + (knowledgeContext.web || "")).toLowerCase();
            let hasHallucinatedJob = false;
            if (plan.domain === 'GOVT_JOB' || plan.intent === 'JOB_QUERY' || finalContent.toLowerCase().includes('vacancy')) {
                const jobMatches = finalContent.match(/\d\.\s+\*\*(.*?)\*\*/g);
                if (jobMatches) {
                    for (const match of jobMatches) {
                        const jobName = match.replace(/\d\.\s+\*\*/, '').replace(/\*\*/, '').trim().toLowerCase();
                        const words = jobName.split(' ').filter(w => w.length > 3);
                        if (words.length > 0 && !words.some(word => sourceText.includes(word))) {
                            hasHallucinatedJob = true;
                            break;
                        }
                    }
                } else if (/\d{2,}/.test(finalContent) && isDataMissing) {
                    hasHallucinatedJob = true;
                }
            }

            // REPAIR LOGIC
            if (!validation.passed || hasHallucinatedJob) {
                if (validation.shouldRetryLLM) {
                    ProgressEmitter.emit(sessionId, 'LLM_REPAIRING');
                    const repairPrompt = `\n\nCRITICAL: Your previous response was rejected due to: ${validation.issues.join(', ')}. Please re-write using ONLY verified data. Remove any invented facts or internal rules.`;
                    const repairResponse = await llm.chat([
                        { role: 'system', content: systemInstruction + repairPrompt },
                        { role: 'user', content: rewrittenQuery }
                    ]);
                    finalContent = repairResponse.content;
                    // Final Validation after repair
                    validation = ResponseValidator.validate(finalContent, validationInput);
                } else {
                    // Code-based cleanup is usually enough for LOW/MEDIUM issues
                    finalContent = ResponseCleaner.clean(finalContent, {
                        isPureGreeting: validationInput.isPureGreeting,
                        intent: plan.intent,
                        query: rewrittenQuery
                    });
                }
            }

            // Fallback for failed strict validation
            if ((!validation.passed || hasHallucinatedJob) && isDataMissing && (['GOVT_JOB', 'CAREER', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'].includes(plan.domain) || ['JOB_QUERY', 'MORE_JOBS', 'MORE_RESULTS', 'SCHOLARSHIP', 'RESULT_ADMIT_CARD'].includes(plan.intent))) {
                finalContent = ResponseCleaner.getFactualFallback();
            } else if (!validation.passed && validationInput.isPureGreeting) {
                finalContent = ResponseCleaner.getGreetingFallback();
            }

            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(finalContent, confidence, {
                intent: plan.intent,
                query: rewrittenQuery,
                isPureGreeting: validationInput.isPureGreeting,
                userProfile: profile
            });

            // --- PHASE 11 & 12: Analytics & State Sync ---
            const updatedState = await ConversationState.update(sessionId, {
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
            await this._persistChat(userName, sessionId, rawInput, processed, metrics, updatedState.topic);

            ProgressEmitter.emit(sessionId, 'FINAL_RESPONSE_READY');

            return { success: true, ...processed, confidence: confidence.score, topic: updatedState.topic, requestId };

        } catch (error) {
            ProgressEmitter.emit(sessionId, 'ERROR');
            metrics.error = error.message;
            Metrics.logRequest(metrics);
            console.error("❌ Orchestration Error:", error);
            return { success: false, message: "Service temporarily unavailable." };
        }
    }

    static async _getLLMProvider() {
        const setting = await Settings.findOne({ key: 'RUNPOD_URL' });
        return new RunpodProvider({ baseUrl: (setting?.value || constants.DEFAULT_RUNPOD_URL).replace(/\/$/, '') + '/api/chat', model: constants.AI_MODEL_NAME });
    }

    static async _fetchDatabaseKnowledge(query, profile, options = {}) {
        const q = query.toLowerCase();
        // Skip filtering for generic "latest" or "top" queries
        const isGeneric = q.includes('top') || q.includes('latest') || q.includes('active') || q.includes('job') || q.includes('vacancy') || q.includes('bharti') || q.includes('data') || q.includes('database');
        const keywords = q.split(/\s+/).filter(w => w.length > 2 && !['jobs', 'bharti', 'vacancy', 'list', 'kaunsi', 'batayein', 'dikhao', 'karein', 'kijiye', 'bare', 'mein', 'data', 'database'].includes(w));

        const now = new Date();
        // Allow jobs that are active, even if lastDate is missing (fallback to null check)
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
                { $or: criteria.$or }, // Keep the date/active filter
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

        // If user profile has qualification, we attempt to filter, but we don't make it mandatory if 0 results
        let jobs = [];
        const offset = Math.max(0, Number(options.pagination?.offset || 0));
        const limit = Math.max(1, Number(options.pagination?.limit || 10));
        if (profile?.qualification) {
            let qualCriteria = { ...criteria };
            const qualRegex = { $regex: profile.qualification, $options: 'i' };
            if (qualCriteria.$and) {
                qualCriteria.$and.push({ 'eligibility.education': qualRegex });
            } else {
                qualCriteria['eligibility.education'] = qualRegex;
            }
            jobs = await Job.find(qualCriteria).sort({ createdAt: -1 }).skip(offset).limit(limit);
        }

        if (jobs.length === 0) {
            let sortCriteria = { lastDate: 1 };
            if (q.includes('new') || q.includes('latest') || q.includes('fresh') || isGeneric) {
                sortCriteria = { createdAt: -1 };
            }
            jobs = await Job.find(criteria).sort(sortCriteria).skip(offset).limit(limit);
        }

        const totalCount = await Job.countDocuments(criteria);

        return {
            count: totalCount,
            jobs: jobs.length > 0 ? jobs.map(j => {
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
            }).join("\n") : ""
        };
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
        // 1. Code-based Cleaning
        let message = ResponseCleaner.clean(content, meta);

        // 2. Formatting & Polish
        message = ResponseFormatter.format(message, meta);

        // 3. Suggestions extraction
        const suggestMatch = content.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i);
        let suggestions = suggestMatch ? suggestMatch[1].split(',').map(s => s.trim()) : [];

        // Extra metadata extraction for legacy support if needed
        const mathMatch = content.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);
        const thinkMatch = content.match(/<(?:think|CALC)>([\s\S]*?)<\/(?:think|CALC)>/i);

        return {
            message,
            calculation: mathMatch ? mathMatch[1].trim() : (thinkMatch ? thinkMatch[1].trim() : ""),
            suggestions: suggestions.slice(0, 3)
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
            Chat.create({ userName: user, sessionId: session, role: 'assistant', content: processed.message, calculation: processed.calculation, suggestions: processed.suggestions, metadata: { confidence: metrics.confidence, topic } })
        ]);
    }
}

module.exports = AIService;
