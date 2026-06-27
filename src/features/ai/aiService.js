const Chat = require('../chat/chatModel');
const Feedback = require('../feedback/feedbackModel');
const Settings = require('../settings/settingsModel');
const Job = require('../jobs/jobModel');
const Jansewa = require('../jansewa/jansewaModel');
const constants = require('../../config/constants');

// Pipeline Modules
const IntentDetector = require('./intentDetector');
const ConversationState = require('./conversationState'); // Now async & pluggable
const UserProfile = require('./userProfile');
const QueryRewriter = require('./queryRewriter');
const Planner = require('./planner');
const KnowledgeRouter = require('./knowledgeRouter');
const PromptComposer = require('./promptComposer');
const SearchService = require('./searchService');
const ResponseValidator = require('./responseValidator');
const ConfidenceEngine = require('./confidenceEngine');

// Enterprise Layers
const RunpodProvider = require('./providers/runpodProvider');
const Metrics = require('./observability/metrics');
const SearchReranker = require('./searchReranker');

class AIService {
    /**
     * Enterprise AI Orchestration Pipeline
     * Target Architecture Score: 10/10
     */
    static async processRequest(input) {
        const startTime = Date.now();
        const { question, userMessage, userName, userLocation, userDOB, userCategory, userQualification, history } = input;

        // Ensure sessionId exists to prevent Validation Errors
        const sessionId = input.sessionId || `session_${Date.now()}`;
        const rawInput = userMessage || question || "";

        let metrics = { intent: 'UNKNOWN', provider: 'NONE', searchUsed: false };

        try {
            // 0. Save User Message (Missing in previous refactor)
            if (rawInput && userName) {
                await Chat.create({ userName, sessionId, role: 'user', content: rawInput }).catch(e => console.error("Chat Save Error:", e));
            }

            // 1. Intelligence Phase
            const intents = IntentDetector.detect(rawInput);
            metrics.intent = intents[0] || 'GENERAL';

            const state = await ConversationState.update(sessionId, rawInput, intents);

            // 2. Context & Rewriting
            const rewrittenQuery = QueryRewriter.rewrite(rawInput, state.topic);
            const plan = Planner.plan(rewrittenQuery, intents);
            const routes = KnowledgeRouter.route(plan, rewrittenQuery);

            // 3. User Profile Fetching
            const userLearnings = await Feedback.find({ userName }).sort({ timestamp: -1 }).limit(5);
            const insights = userLearnings.map(l => l.rating === 'up' ? `LIKED: ${l.aiResponse.substring(0, 20)}` : `DISLIKED: ${l.aiResponse.substring(0, 20)}`).join(' | ');
            const profile = UserProfile.format({ name: userName, loc: userLocation, dob: userDOB, cat: userCategory, qual: userQualification, insights });

            // 4. Knowledge Acquisition (Strict DATABASE PRIORITY POLICY)
            let liveData = { jobs: "", kendras: "", web: "" };
            let dbFound = false;

            if (routes.selectedSources.includes('DATABASE')) {
                const dbResults = await this._fetchDbData(rewrittenQuery);
                liveData.jobs = dbResults.jobs;
                liveData.kendras = dbResults.kendras;
                if (dbResults.count > 0) dbFound = true;
            }

            // Rule: Only search if Database had no matching jobs AND search is enabled
            if (!dbFound && routes.shouldCheckSearchIfDbFails) {
                metrics.searchUsed = true;
                const searchResults = await this._fetchWebData(rewrittenQuery);
                liveData.web = searchResults;

                // Rule: If search found verified data, we could "Shadow Save" it
                // (Implementation for future: Auto-seed DB from high-confidence search)
            }

            // 5. Prompt Construction (ENTERPRISE: Versioned & Async)
            const indiaDate = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });
            const meta = {
                currentDate: indiaDate.split(',')[0],
                currentYear: indiaDate.split('/')[2],
                sessionId
            };

            const systemInstruction = await PromptComposer.build(plan.priorityModules, profile, liveData, meta);
            metrics.promptSize = systemInstruction.length;

            // 6. LLM Provider Layer
            const llm = await this._getLLMProvider();
            metrics.provider = llm.provider;

            const aiResponse = await llm.chat([
                { role: 'system', content: systemInstruction },
                ...(history || []),
                { role: 'user', content: rewrittenQuery }
            ]);

            // 7. Quality Assurance & Hallucination Check
            let finalContent = aiResponse.content;
            const hasFactualData = !!(liveData.jobs || liveData.web);
            const validation = ResponseValidator.validate(finalContent, { query: rewrittenQuery, liveData, intent: plan.intent });

            // 8. SMART FALLBACK LOGIC
            if (!validation.isValid) {
                if (!hasFactualData) {
                    // Scenario: Database/Search khali hai.
                    // LLM ko bolo ki generic career advice de par fake numbers na likhe.
                    const fallbackResponse = await llm.chat([
                        { role: 'system', content: systemInstruction + "\n\nNOTE: Official notification data for this specific query is currently unavailable. DO NOT invent dates or salaries. Provide general career guidance and typical eligibility." },
                        { role: 'user', content: rewrittenQuery }
                    ]);
                    finalContent = fallbackResponse.content;
                } else {
                    // Data tha par LLM ne galti ki, ek baar sudharne ka mauka dein
                    const correction = await llm.chat([
                        { role: 'system', content: systemInstruction + "\n\nCRITICAL: Your last response was rejected for unverified numbers. Use ONLY provided data." },
                        { role: 'user', content: rewrittenQuery }
                    ]);
                    finalContent = correction.content;
                }
            }

            const confidence = ConfidenceEngine.calculate(plan, liveData, validation);
            metrics.confidence = confidence.score;

            // 9. Output Processing
            const processed = this._finalProcess(finalContent, confidence);

            // 9. Metrics & Persistence
            metrics.latency = Date.now() - startTime;
            Metrics.logRequest(metrics);

            await this._persistChat(userName, sessionId, processed, metrics, state.topic, rewrittenQuery);

            return {
                success: true,
                ...processed,
                confidence: confidence.score,
                topic: state.topic
            };

        } catch (error) {
            metrics.error = error.message;
            Metrics.logRequest(metrics);
            console.error("❌ Enterprise Pipeline Error:", error);
            return { success: false, message: "Service temporarily unavailable." };
        }
    }

    // --- Enterprise Infrastructure Helpers ---

    static async _getLLMProvider() {
        const runpodSetting = await Settings.findOne({ key: 'RUNPOD_URL' });
        const runpodUrl = (runpodSetting && runpodSetting.value) || constants.DEFAULT_RUNPOD_URL;

        // Strategy: We can easily add 'if (useOpenAI) return new OpenAIProvider(...)'
        return new RunpodProvider({
            baseUrl: runpodUrl.includes('/api/chat') ? runpodUrl : runpodUrl.replace(/\/$/, '') + '/api/chat',
            model: constants.AI_MODEL_NAME
        });
    }

    static async _fetchDbData(query) {
        const q = query.toLowerCase();
        const keywords = q.split(/\s+/).filter(w => w.length > 3 && !['jobs', 'jankari', 'bharti', 'vacancy'].includes(w));

        let searchCriteria = { isActive: true };

        if (keywords.length > 0) {
            searchCriteria.$or = [
                { title: { $regex: keywords.join('|'), $options: 'i' } },
                { organization: { $regex: keywords.join('|'), $options: 'i' } }
            ];
        }

        const [jobs, kendras] = await Promise.all([
            Job.find(searchCriteria).sort({ _id: -1 }).limit(8),
            Jansewa.find().limit(2)
        ]);

        return {
            count: jobs.length,
            jobs: jobs.length > 0
                ? jobs.map(j => `- JOB: ${j.title} | Org: ${j.organization} | Vacancy: ${j.totalVacancy || "Check Notification"} | Date: ${j.importantDates?.applicationLastDate || "NA"} | Salary: ${j.salary || "As per rules"}`).join("\n")
                : "",
            kendras: kendras.map(k => k.name).join(", ")
        };
    }

    static async _fetchWebData(query) {
        const [key, cx] = await Promise.all([
            Settings.findOne({ key: 'GOOGLE_SEARCH_API_KEY' }),
            Settings.findOne({ key: 'GOOGLE_SEARCH_CX' })
        ]);
        if (!key?.value) return "";
        const rawResults = await SearchService.search(query, key.value, cx.value);

        // ENTERPRISE OPTIMIZATION: Rerank and pick only the best snippets
        const topResults = SearchReranker.rank(query, rawResults);
        return topResults.length > 0 ? JSON.stringify(topResults) : "";
    }

    static _finalProcess(content, confidence) {
        const math = content.match(/<HIDDEN_MATH>([\s\S]*?)<\/HIDDEN_MATH>/i);
        const msg = content.match(/<USER_MESSAGE>([\s\S]*?)<\/USER_MESSAGE>/i);
        let message = msg ? msg[1].trim() : content.replace(/<(HIDDEN_MATH|USER_MESSAGE)>[\s\S]*?<\/\1>/gi, '').trim();

        if (!confidence.isReliable) message += `\n\n*(Verified Source Recommended)*`;

        return {
            message,
            calculation: math ? math[1].trim() : "",
            suggestions: (content.match(/\[SUGGESTIONS\s*:\s*(.*?)\]/i) || ["", ""])[1].split(',').map(s => s.trim())
        };
    }

    static async _persistChat(user, session, processed, metrics, topic, query) {
        if (!processed.message || !user) return;
        await Chat.create({
            userName: user,
            sessionId: session,
            role: 'assistant',
            content: processed.message,
            calculation: processed.calculation,
            suggestions: processed.suggestions,
            metadata: {
                confidence: metrics.confidence,
                latency: metrics.latency,
                provider: metrics.provider,
                topic
            }
        });
    }
}

module.exports = AIService;
