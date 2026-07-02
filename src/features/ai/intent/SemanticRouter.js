/**
 * SemanticRouter Module (Phase 2 Speed Optimization)
 * Responsibility: Near-instant intent detection using local embeddings.
 * This skips the Intent LLM call for common request patterns.
 */
const VectorService = require('../knowledge/vectorService');

const INTENT_ANCHORS = {
    JOB_SEARCH: [
        "latest government jobs", "ssc railway vacancies", "12th pass naukri",
        "sarkari bharti list", "bank exams notification", "police job apply link",
        "army agniveer vacancy", "high court jobs", "upsc civil services",
        "nayi bharti kab aayegi", "jobs for graduates", "part time jobs",
        "female candidate vacancies", "bihar police vacancy", "running me mere liye jobs",
        "kuch aur h kya mere liye", "iske alaba jobs"
    ],
    FIELD_DETAILS: [
        "exam syllabus kya hai", "application fees kitni hai", "last date kab hai",
        "eligibility criteria", "age limit kitni hai", "salary kitni milegi",
        "physical standard for police", "how to apply online", "selection process"
    ],
    PROFILE_INQUIRY: [
        "meri age kya h", "m abhi kitne sal ka hu", "meri qualification kya hai",
        "mera naam kya hai", "meri profile dikhao", "my age and category"
    ],
    CONTINUE: [
        "karo bhai", "haan dikhao", "yes please", "zaroor", "theek hai karo",
        "aage batao", "process karo", "show me", "continue"
    ],
    CAREER_GUIDANCE: [
        "10th ke baad kya kare", "best career after 12th commerce", "ias kaise bane",
        "software engineer ki padhai", "government vs private job guide",
        "career options for biology students", "graduation ke baad kya scope hai"
    ],
    MOTIVATION: [
        "kya karne ka fayda hai", "mann nahi lag raha", "fail ho gaya hu",
        "pareshan hu career ko lekar", "kuch samajh nahi aa raha",
        "zindagi me kya kare", "demotivated feel kar raha hu", "himmat har gaya"
    ],
    ORDINAL_FOLLOWUP: [
        "2 no bali job", "pehle wali job", "1 number wali", "second option",
        "more details on 3rd", "details of 2", "dusri wali", "pehli wali details",
        "details about number 2", "more info on 1"
    ],
    RESUME: [
        "resume kaise banaye", "cv format download", "resume building tips",
        "professional summary for resume", "resume me kya likhe"
    ]
};

class SemanticRouter {
    static anchorVectors = new Map();
    static isInitialized = false;

    static async init() {
        if (this.isInitialized) return;
        console.log("🚀 Initializing Semantic Router (Turbo Mode)...");
        for (const [intent, examples] of Object.entries(INTENT_ANCHORS)) {
            const vectors = await Promise.all(examples.map(ex => VectorService.generate(ex)));
            this.anchorVectors.set(intent, vectors.filter(v => v !== null));
        }
        this.isInitialized = true;
    }

    static async route(query, state = {}) {
        await this.init();

        const history = state.history || [];
        const lastAssistantMessage = history.length > 0 ? history[history.length - 1].assistant : "";
        const currentTopic = state.currentTopic || state.topic || "GENERAL";

        const queryWords = query.trim().split(/\s+/);
        const isShortQuery = queryWords.length <= 3;
        const lastAiAskedQuestion = lastAssistantMessage.includes('?') || lastAssistantMessage.includes('karu') || lastAssistantMessage.includes('dikhau');

        // --- STEP 1: PIVOT CHECK (Priority to New Clear Intents) ---
        // We check the original query FIRST without context to see if user is changing topic
        const rawQueryVector = await VectorService.generate(query);
        const topRawIntent = this._getBestMatch(rawQueryVector);

        if (topRawIntent && topRawIntent.score > 0.88) {
            console.log(`🔀 Intent Pivot Detected: Switching to ${topRawIntent.intent}`);
            return this._buildMatch(topRawIntent.intent, topRawIntent.score, "Intent Pivot");
        }

        // --- STEP 2: CONTEXTUAL STATE MACHINE (Affirmations) ---
        if (isShortQuery && lastAiAskedQuestion) {
            const lowerQuery = query.toLowerCase();
            const affirmative = ["karo", "haan", "yes", "dikhao", "ok", "theek h", "zaroor", "karo bhai", "show", "btao"];

            if (affirmative.some(a => lowerQuery.includes(a))) {
                const likelyIntent = (currentTopic === 'JOB_SEARCH' || lastAssistantMessage.toLowerCase().includes('job')) ? 'JOB_SEARCH' : 'CONTINUE';
                return this._buildMatch(likelyIntent, 0.99, "State Transition");
            }
        }

        // --- STEP 3: CONTEXT-ENRICHED MATCHING (Follow-ups) ---
        const enrichedQuery = `[Topic: ${currentTopic}] ${query}`;
        const enrichedVector = await VectorService.generate(enrichedQuery);
        const topEnrichedIntent = this._getBestMatch(enrichedVector);

        if (topEnrichedIntent && topEnrichedIntent.score > 0.80) {
            return this._buildMatch(topEnrichedIntent.intent, topEnrichedIntent.score, "Enriched Match");
        }

        return null;
    }

    static _getBestMatch(vector) {
        if (!vector) return null;
        let bestIntent = null;
        let highestScore = 0;

        for (const [intent, anchors] of this.anchorVectors.entries()) {
            const score = this._getMaxSimilarity(vector, anchors);
            if (score > highestScore) {
                highestScore = score;
                bestIntent = intent;
            }
        }
        return { intent: bestIntent, score: highestScore };
    }

    static _buildMatch(intent, score, reasoning) {
        console.log(`⚡ Semantic Route: ${intent} (${reasoning}) | Score: ${score.toFixed(3)}`);
        return {
            intent: intent,
            confidence: score,
            needsPlanning: false,
            execution: this._getDefaultExecution(intent),
            mode: this._getMode(intent),
            searchStrategy: {
                skipLlmExpansion: true,
                skipLlmRerank: true,
                reason: reasoning
            }
        };
    }

    static _getMaxSimilarity(queryVec, anchors) {
        let max = 0;
        for (const anchor of anchors) {
            const sim = this._cosineSimilarity(queryVec, anchor);
            if (sim > max) max = sim;
        }
        return max;
    }

    static _cosineSimilarity(vecA, vecB) {
        let dot = 0, mA = 0, mB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            mA += vecA[i] * vecA[i];
            mB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(mA) * Math.sqrt(mB));
    }

    static _getMode(intent) {
        const mapping = {
            'JOB_SEARCH': 'JOB_SEARCH',
            'FIELD_DETAILS': 'JOB_DETAILS',
            'ORDINAL_FOLLOWUP': 'JOB_DETAILS',
            'PROFILE_INQUIRY': 'PROFILE_HELP',
            'CONTINUE': 'JOB_SEARCH', // Map affirmative to job search by default
            'CAREER_GUIDANCE': 'CAREER_GUIDANCE',
            'MOTIVATION': 'CAREER_GUIDANCE',
            'RESUME': 'RESUME_HELP'
        };
        return mapping[intent] || 'GENERAL_HELP';
    }

    static _getDefaultExecution(intent) {
        // ALWAYS include MEMORY tool to ensure follow-up context is never lost
        const base = [{ step: 1, tool: "MEMORY", purpose: "load history" }];

        if (intent === 'JOB_SEARCH' || intent === 'ORDINAL_FOLLOWUP' || intent === 'CONTINUE') {
            return [...base, { step: 2, tool: "RAG", purpose: "search" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        if (intent === 'FIELD_DETAILS') {
            return [...base, { step: 2, tool: "RAG", purpose: "details" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        if (intent === 'PROFILE_INQUIRY' || intent === 'MOTIVATION') {
            return [...base, { step: 2, tool: "PROFILE", purpose: "fetch user profile" }, { step: 3, tool: "LLM", purpose: "synthesis" }];
        }
        return [...base, { step: 2, tool: "LLM", purpose: "direct response" }];
    }
}

module.exports = SemanticRouter;
