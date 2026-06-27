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
            const intentObj = IntentDetector.detect(rawInput);

            // --- PHASE 5: Planning ---
            ProgressEmitter.emit(sessionId, 'PLANNING');
            const plan = Planner.plan(rawInput, intentObj, state, profile);
            metrics.intent = plan.intent;

            // --- PHASE 6: Knowledge Routing ---
            const rewrittenQuery = QueryRewriter.rewrite(rawInput, state.topic);
            const routes = KnowledgeRouter.route(plan, rewrittenQuery);

            // --- PHASE 7: Data Collection ---
            let knowledgeContext = { jobs: "", web: "", profileStr: UserProfile.toContextString(profile) };
            if (routes.isFactualQuery || plan.behavior === 'PROCESS_INPUT' || plan.intent === 'GOVT_JOB') {
                if (routes.selectedSources.includes('DATABASE')) ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');

                let searchQuery = (rawInput.length < 5 && state.lastDomain !== 'GENERAL') ? state.lastDomain : rewrittenQuery;

                // Improved follow-up search: If query is very short (e.g., "batao", "dikhao"), use the topic
                const isShortQuery = rawInput.length < 10 && (rawInput.includes('batao') || rawInput.includes('dikhao') || rawInput.includes('jobs'));
                if (isShortQuery && state.topic && state.topic !== 'GENERAL') {
                    searchQuery = state.topic + " " + rawInput;
                }

                let [dbResult, webData] = await Promise.all([
                    this._fetchDatabaseKnowledge(searchQuery, profile),
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
                behavior: plan.behavior
            };

            const systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');

            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            const aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nCRITICAL: Today is ${indiaDateStr}. The current year is ${currentYear}. Only discuss jobs active in ${currentYear} or later. Disregard any internal knowledge of previous years.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            let finalContent = aiResponse.content;

            // --- PHASE 10: Validation ---
            ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');
            const validation = ResponseValidator.validate(finalContent, { query: rewrittenQuery, liveData: knowledgeContext, intent: plan.intent });

            if (!validation.isValid && !knowledgeContext.jobs && !knowledgeContext.web && ['GOVT_JOB', 'CAREER', 'SCHOLARSHIP'].includes(plan.intent)) {
                // If data is missing, don't let AI guess
                finalContent = "<USER_MESSAGE>Maaf kijiye, mujhe is baare mein abhi koi verified notification ya jankari nahi mili hai. Aap ek baar official website zaroor check kar lein.</USER_MESSAGE>";
            } else if (!validation.isValid && plan.needReasoning) {
                const correction = await llm.chat([{ role: 'system', content: systemInstruction + "\n\nCRITICAL: Your previous response was rejected. Use only verified data." }, { role: 'user', content: rewrittenQuery }]);
                finalContent = correction.content;
            }

            ProgressEmitter.emit(sessionId, 'RESPONSE_FORMATTING');
            const confidence = ConfidenceEngine.calculate(plan, knowledgeContext, validation);
            const processed = this._finalProcess(finalContent, confidence);

            // --- PHASE 11 & 12: Analytics ---
            await ConversationState.update(sessionId, rawInput, intentObj.acts, intentObj.domains, finalContent);
            metrics.latency = Date.now() - startTime;
            Metrics.logRequest(metrics);
            await this._persistChat(userName, sessionId, rawInput, processed, metrics, state.topic);

            ProgressEmitter.emit(sessionId, 'FINAL_RESPONSE_READY');

            return { success: true, ...processed, confidence: confidence.score, topic: state.topic, requestId };

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

    static async _fetchDatabaseKnowledge(query, profile) {
        const q = query.toLowerCase();
        // Skip filtering for generic "latest" or "top" queries
        const isGeneric = q.includes('top') || q.includes('latest') || q.includes('active') || q.includes('job') || q.includes('vacancy');
        const keywords = q.split(/\s+/).filter(w => w.length > 2 && !['jobs', 'bharti', 'vacancy', 'list', 'kaunsi', 'batayein', 'dikhao', 'karein', 'kijiye', 'bare', 'mein'].includes(w));

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
        const [key, cx] = await Promise.all([Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }), Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })]);
        if (!key?.value) return "";
        const results = await SearchService.search(query, key.value, cx.value);
        const reranked = SearchReranker.rank(query, results);
        return JSON.stringify(reranked);
    }

    static _finalProcess(content, confidence) {
        // 1. EXTRACTION: Strictly extract only user message content
        const userMessageMatch = content.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
        const mathMatch = content.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);
        const thinkMatch = content.match(/<(?:think|CALC)>([\s\S]*?)<\/(?:think|CALC)>/i);

        let message = userMessageMatch ? userMessageMatch[1].trim() : content;

        // Remove ANY system tags that might have leaked
        message = message.replace(/<(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>[\s\S]*?<\/\1>/gi, '').trim();
        message = message.replace(/<(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '').replace(/<\/(?:HIDDEN_MATH|USER_MESSAGE|think|CALC)>/gi, '');

        // 2. CLEANUP: Remove rules and debug phrases
        const blacklisted = [
            /verified source recommended/gi, /backend rule/gi, /system rule/gi,
            /sarkari naukri ka niyam/gi, /i must not guess/gi, /as per my rule/gi,
            /internal validation/gi, /source recommended/gi, /hallucination guard/gi,
            /sourceverified/gi, /validation failed/gi, /official source recommended/gi,
            /sapni wala data/gi, /aapne yes kaha/gi, /you said yes/gi
        ];

        blacklisted.forEach(reg => { message = message.replace(reg, ''); });

        // 3. FORMATTING: Clean up spaces
        message = message.trim();

        // 4. Suggestions extraction
        const suggestMatch = content.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i);
        let suggestions = suggestMatch ? suggestMatch[1].split(',').map(s => s.trim()) : [];

        return {
            message,
            calculation: mathMatch ? mathMatch[1].trim() : (thinkMatch ? thinkMatch[1].trim() : ""),
            suggestions: suggestions.slice(0, 3)
        };
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
