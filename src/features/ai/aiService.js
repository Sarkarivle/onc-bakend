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
            if (routes.shouldFetchLiveData) {
                if (routes.selectedSources.includes('DATABASE')) ProgressEmitter.emit(sessionId, 'DATABASE_CHECKING');
                if (routes.selectedSources.includes('SEARCH')) ProgressEmitter.emit(sessionId, 'SEARCHING_VERIFIED_SOURCES');

                const [dbData, webData] = await Promise.all([
                    routes.selectedSources.includes('DATABASE') ? this._fetchDatabaseKnowledge(rewrittenQuery, profile) : null,
                    routes.selectedSources.includes('SEARCH') ? this._fetchWebKnowledge(rewrittenQuery) : null
                ]);
                if (dbData) knowledgeContext.jobs = dbData;
                if (webData) knowledgeContext.web = webData;
            }

            // --- PHASE 8 & 9: LLM Execution ---
            ProgressEmitter.emit(sessionId, 'PROMPT_COMPOSING');
            const indiaDate = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });
            const promptMeta = { currentDate: indiaDate.split(',')[0], currentYear: indiaDate.split('/')[2], sessionId, behavior: plan.behavior };
            const systemInstruction = await PromptComposer.build(plan.priorityModules, profile, knowledgeContext, promptMeta);

            ProgressEmitter.emit(sessionId, 'LLM_THINKING');

            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            const aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction + `\n\nBEHAVIOR: ${plan.behavior}. DATA STATUS: ${knowledgeContext.profileStr}.` },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            let finalContent = aiResponse.content;

            // --- PHASE 10: Validation ---
            ProgressEmitter.emit(sessionId, 'RESPONSE_VALIDATION');
            const validation = ResponseValidator.validate(finalContent, { query: rewrittenQuery, liveData: knowledgeContext, intent: plan.intent });

            if (!validation.isValid && plan.needReasoning) {
                const correction = await llm.chat([{ role: 'system', content: systemInstruction + "\n\nCRITICAL: Use only verified data." }, { role: 'user', content: rewrittenQuery }]);
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
        const keywords = q.split(/\s+/).filter(w => w.length > 3 && !['jobs', 'bharti', 'vacancy'].includes(w));

        const now = new Date();
        let criteria = {
            isActive: true,
            lastDate: { $gte: now } // Expiry Rule: Only show future or today's last date
        };

        // Profile-based filtering
        if (profile?.qualification) {
            criteria['eligibility.education'] = { $regex: profile.qualification, $options: 'i' };
        }

        if (keywords.length > 0) {
            criteria.$or = [
                { title: { $regex: keywords.join('|'), $options: 'i' } },
                { organization: { $regex: keywords.join('|'), $options: 'i' } }
            ];
        }

        // Sort by nearest last date first
        const jobs = await Job.find(criteria).sort({ lastDate: 1 }).limit(5);

        return jobs.length > 0
            ? jobs.map(j => `- JOB: ${j.title} | Org: ${j.organization} | Last Date: ${j.importantDates?.applicationLastDate || j.lastDate?.toDateString()} | Eligibility: ${j.eligibility?.education} | Salary: ${j.salary}`).join("\n")
            : "";
    }

    static async _fetchWebKnowledge(query) {
        const [key, cx] = await Promise.all([Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }), Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })]);
        if (!key?.value) return "";
        const results = await SearchService.search(query, key.value, cx.value);
        const reranked = SearchReranker.rank(query, results);
        return JSON.stringify(reranked);
    }

    static _finalProcess(content, confidence) {
        const math = content.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);
        const msg = content.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
        let message = msg ? msg[1].trim() : content.replace(/<(HIDDEN_MATH|USER_MESSAGE)>[\s\S]*?<\/\1>/gi, '').trim();

        // 1. STRICT INTERNAL RULE CLEANER
        const systemNotes = [
            /verified source recommended/gi,
            /backend rule/gi,
            /system rule/gi,
            /sarkari naukri ka niyam/gi,
            /i must not guess/gi,
            /as per my rule/gi,
            /internal validation/gi,
            /source recommended/gi,
            /hallucination guard/gi,
            /sourceverified/gi,
            /validation failed/gi,
            /official source recommended/gi,
            /maine sapni wala data nikala/gi,
            /please respond with one of the following/gi,
            /planner decision/gi,
            /intent detected/gi,
            /confidence score/gi,
            /search router/gi,
            /database miss/gi,
            /internal database/gi,
            /note:/gi,
            /validation note:/gi
        ];

        systemNotes.forEach(regex => {
            message = message.replace(regex, '');
        });

        // 2. Formatting cleanup
        message = message.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();

        // 3. Extract Suggestions
        const suggestMatch = content.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i);
        let suggestions = suggestMatch ? suggestMatch[1].split(',').map(s => s.trim()) : [];

        // Remove suggestions if they contain system rules
        suggestions = suggestions.filter(s => !systemNotes.some(regex => s.match(regex)));

        return {
            message,
            calculation: math ? math[1].trim() : "",
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
