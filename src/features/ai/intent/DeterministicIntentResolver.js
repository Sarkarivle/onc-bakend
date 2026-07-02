/**
 * DeterministicIntentResolver Module
 * Responsibility: Provides fast, rule-based resolution for common intents and behaviors
 * before attempting more expensive semantic or LLM-based classification.
 */

const GREETINGS = ['hi', 'hello', 'kaise ho', 'namaste', 'ram ram', 'hey', 'good morning', 'good afternoon', 'good evening', 'suprabhat', 'kya haal hai', 'suno', 'help', 'salaam', 'oye jobo', 'ek help chahiye', 'bolo'];
const IDENTITY_QUERIES = ['who are you', 'tum kaun ho', 'aapka naam kya hai', 'tell me about yourself', 'kya kaam karte ho', 'jobo', 'what is your name', 'kon ho tum', 'tum kya kar sakte ho', 'what are your capabilities', 'kya bata sakte ho tum', 'kya kya kar sakte ho'];
const THANKS_OK = ['theek hai', 'shukriya', 'ok thanks', 'acha ji', 'thank you', 'ok', 'good', 'nice', 'dhanyawad', 'thanks', 'samajh gaya'];
const AMBIGUOUS_SHORT = ['naukri', 'fees?', 'form?', 'apply?', 'form kaise bharein?', 'details', 'yojna', 'form', 'apply', "don't know", 'kuch aur', 'batao'];

const EXAMS = [
    'ssc', 'upsc', 'railway', 'ntpc', 'group d', 'up police', 'delhi police', 'cgl', 'chsl', 'mts',
    'bank po', 'ibps', 'clerk', 'army', 'navy', 'airforce', 'agniveer', 'ctet', 'tet', 'pet', 'vdo', 'lekhpal',
    'navy mr', 'navy ssr', 'itbp', 'bsf', 'cisf', 'crpf', 'ssb', 'gd constable', 'daroga', 'si'
];

const DETAIL_TERMS = [
    'last date', 'apply date', 'fees', 'fee', 'eligibility', 'qualification', 'age limit',
    'salary', 'syllabus', 'admit card', 'result', 'details', 'notification',
    'form kaise', 'kaise apply', 'apply kaise', 'apply link', 'kab aayega', 'exam kab'
];

const PROFILE_TERMS = [
    'meri profile', 'my profile', 'mera profile', 'meri age', 'my age', 'meri category',
    'meri qualification', 'my qualification', 'mere bare', 'mujhe kya suit', 'mera naam',
    'update my location', 'my location', 'meri location'
];

const JOB_SEARCH_TERMS = [
    'govt jobs', 'government job', 'sarkari naukri', 'bharti', 'vacancy', 'vacancies',
    'job openings', '12th pass jobs', 'female candidate jobs', 'new vacancies', 'jobz',
    'bank jobs'
];

const CAREER_TERMS = [
    'kaise bane', 'kaise crack', 'career', 'scope', 'after 12th', '10th ke baad',
    '12th ke baad', 'government vs private', 'software engineer', 'suggest a career',
    'what should i do', 'b.com', 'bcom'
];

const COMPLEX_PLANNING_TERMS = ['compare', 'best path', 'which is better', 'pros and cons'];

const GENERAL_TERMS = ['weather', 'cricket score', 'maths solve', 'prime minister'];
const MOTIVATION_TERMS = ['study motivation', 'motivation'];
const DISCOVERY_TERMS = ['latest govt jobs', 'top 10 highest paying jobs', 'highest paying jobs'];
const RESULT_TERMS = ['result', 'admit card'];
const RESUME_TERMS = ['resume', 'cv review'];
const SCHOLARSHIP_TERMS = ['scholarship'];
const INTERVIEW_TERMS = ['interview'];
const SKILLS_TERMS = ['skills'];

const SAFETY_BLOCK_KEYWORDS = [
    // Prompt Injection & Internal Info
    'ignore previous', 'system prompt', 'internal rules', 'developer key', 'config.json',
    'reveal your', 'reveal config', 'hidden rules', 'bypass filters', 'underlying model', 'architecture', 'safety filters',
    // Malicious & Unsafe
    'hack', 'admin access', 'internal database', 'system command', 'rm -rf',
    'steal passwords', 'private data', 'dirty joke', 'drugs', 'scam people', 'fake job scam'
];

class DeterministicIntentResolver {
    static resolve(query) {
        const normalizedQuery = query.toLowerCase().trim();

        if (!normalizedQuery) {
            return this._createResponse({ behavior: 'BLOCK', reasoning: 'Empty query' });
        }

        // Safety Block comes before all fast routing.
        if (SAFETY_BLOCK_KEYWORDS.some(keyword => normalizedQuery.includes(keyword))) {
            return this._createResponse({
                intent: 'SAFETY_VIOLATION',
                behavior: 'BLOCK',
                reasoning: 'Safety keyword match'
            });
        }

        // Preserve fixed clarification behavior for old short/vague queries.
        if (AMBIGUOUS_SHORT.includes(normalizedQuery)) {
            return this._createResponse({
                intent: 'AMBIGUOUS_QUERY',
                behavior: 'CLARIFY',
                reasoning: 'Short ambiguous query'
            });
        }

        // Greetings should stay fixed even when the user mentions a topic after saying hi.
        if (GREETINGS.some(g => normalizedQuery.startsWith(g) || normalizedQuery.endsWith(g))) {
             return this._createResponse({
                intent: 'GREETING',
                behavior: 'GREET',
                reasoning: 'Greeting keyword match'
            });
        }

        if (CAREER_TERMS.some(term => normalizedQuery.includes(term))) {
            return {
                rawIntent: 'CAREER_GUIDANCE',
                normalizedIntent: 'CAREER_GUIDANCE',
                intent: 'CAREER_GUIDANCE',
                domain: 'CAREER',
                act: 'ADVISE',
                mode: 'CAREER_GUIDANCE',
                confidence: 0.95,
                refinedQuery: normalizedQuery,
                needsPlanning: false,
                parallel: false,
                execution: [{ step: 1, tool: "LLM", purpose: "career guidance synthesis" }],
                behavior: "RESPOND",
                needsClarification: false,
                slots: {},
                reasoningShort: "Deterministic: clear career guidance request"
            };
        }

        if (MOTIVATION_TERMS.some(term => normalizedQuery.includes(term))) {
            return {
                rawIntent: 'MOTIVATION',
                normalizedIntent: 'MOTIVATION',
                intent: 'MOTIVATION',
                domain: 'CAREER',
                act: 'MOTIVATE',
                mode: 'CAREER_GUIDANCE',
                confidence: 0.9,
                refinedQuery: normalizedQuery,
                needsPlanning: false,
                parallel: false,
                execution: [{ step: 1, tool: "LLM", purpose: "motivation response" }],
                behavior: "RESPOND",
                needsClarification: false,
                slots: {},
                reasoningShort: "Deterministic: motivation request"
            };
        }

        if (RESUME_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._directPlan('RESUME', 'CAREER', 'RESUME_HELP', normalizedQuery, 'resume help');
        }

        if (SCHOLARSHIP_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._directPlan('SCHOLARSHIP', 'SCHOLARSHIP', 'JOB_SEARCH', normalizedQuery, 'scholarship search');
        }

        if (INTERVIEW_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._directPlan('INTERVIEW', 'CAREER', 'CAREER_GUIDANCE', normalizedQuery, 'interview help');
        }

        if (SKILLS_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._directPlan('SKILLS', 'CAREER', 'CAREER_GUIDANCE', normalizedQuery, 'skills guidance');
        }

        if (RESULT_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._directPlan('RESULT_ADMIT_CARD', 'JOBS', 'JOB_DETAILS', normalizedQuery, 'result/admit card request');
        }

        if (DISCOVERY_TERMS.some(term => normalizedQuery.includes(term))) {
            return {
                rawIntent: 'DISCOVERY',
                normalizedIntent: 'DISCOVERY',
                intent: 'DISCOVERY',
                domain: 'JOBS',
                act: 'SEARCH',
                mode: 'JOB_SEARCH',
                confidence: 0.95,
                refinedQuery: normalizedQuery,
                needsPlanning: false,
                parallel: true,
                execution: [{ step: 1, tool: "RAG", purpose: "discover jobs" }],
                behavior: "RESPOND",
                needsClarification: false,
                slots: {},
                searchStrategy: {
                    skipLlmExpansion: true,
                    skipLlmRerank: true,
                    reason: "Clear deterministic discovery intent"
                },
                reasoningShort: "Deterministic: discovery request"
            };
        }

        // 1. FAST INTENT MATCH: Jobs and clear job/detail requests.
        if (
            !COMPLEX_PLANNING_TERMS.some(term => normalizedQuery.includes(term)) && (
            normalizedQuery === 'jobs' ||
            normalizedQuery === 'vacancies' ||
            EXAMS.some(e => normalizedQuery.includes(e)) ||
            JOB_SEARCH_TERMS.some(term => normalizedQuery.includes(term)) ||
            DETAIL_TERMS.some(term => normalizedQuery.includes(term)))
        ) {
            const intent = DETAIL_TERMS.some(term => normalizedQuery.includes(term)) ? 'FIELD_DETAILS' : 'JOB_SEARCH';
            return {
                rawIntent: intent,
                normalizedIntent: intent,
                intent,
                domain: 'JOBS',
                act: 'SEARCH',
                mode: intent === 'FIELD_DETAILS' ? 'JOB_DETAILS' : 'JOB_SEARCH',
                confidence: 1.0,
                refinedQuery: normalizedQuery.length < 3 ? 'latest jobs' : normalizedQuery,
                needsPlanning: false,
                parallel: true,
                execution: [{ step: 1, tool: "RAG", purpose: "search latest jobs/exams" }],
                behavior: "RESPOND",
                needsClarification: false,
                slots: {},
                searchStrategy: {
                    skipLlmExpansion: true,
                    skipLlmRerank: true,
                    reason: "Clear deterministic job/detail intent"
                },
                reasoningShort: "Deterministic: clear job/detail request"
            };
        }

        if (PROFILE_TERMS.some(term => normalizedQuery.includes(term))) {
            return {
                rawIntent: 'PROFILE_INQUIRY',
                normalizedIntent: 'PROFILE_INQUIRY',
                intent: 'PROFILE_INQUIRY',
                domain: 'PROFILE',
                act: 'INFORM',
                mode: 'PROFILE_HELP',
                confidence: 1.0,
                refinedQuery: normalizedQuery,
                needsPlanning: false,
                parallel: false,
                execution: [{ step: 1, tool: "PROFILE", purpose: "answer from user profile" }],
                behavior: "RESPOND",
                needsClarification: false,
                slots: {},
                reasoningShort: "Deterministic: basic profile request"
            };
        }

        if (GENERAL_TERMS.some(term => normalizedQuery.includes(term))) {
            return this._createResponse({
                intent: 'GENERAL_QUERY',
                behavior: 'RESPOND',
                reasoning: 'General query fixed baseline'
            });
        }

        // 3. Identity Queries
        if (IDENTITY_QUERIES.some(q => normalizedQuery.includes(q) || q.includes(normalizedQuery))) {
            return this._createResponse({
                intent: 'IDENTITY',
                behavior: 'RESPOND',
                reasoning: 'Identity query match'
            });
        }

        // 4. Thanks / OK
        if (THANKS_OK.includes(normalizedQuery)) {
            return this._createResponse({
                intent: 'ACKNOWLEDGEMENT',
                behavior: 'OK_RESPONSE',
                reasoning: 'Acknowledgement phrase match'
            });
        }

        // 6. Garbage Input
        if (/^[\d\s.,?!]+$/.test(normalizedQuery) || /^[a-z]{1,4}$/.test(normalizedQuery) || !/[a-z0-9]/i.test(normalizedQuery)) {
             if (normalizedQuery.length < 5 && /^\d+$/.test(normalizedQuery)) {
                // pass for now, could be age or number
             } else {
                return this._createResponse({
                    intent: 'GARBAGE',
                    behavior: 'BLOCK',
                    reasoning: 'Garbage/random input'
                });
             }
        }

        // No deterministic match found
        return null;
    }

    /**
     * Helper to create a consistent response object that satisfies the IntentEngine contract.
     */
    static _createResponse({ intent, behavior, reasoning }) {
        const normalizedIntent = intent;
        const mode = behavior === 'GREET' || intent === 'IDENTITY' || intent === 'GENERAL_QUERY'
            ? 'GENERAL_HELP'
            : 'FALLBACK';
        return {
            rawIntent: intent,
            normalizedIntent: normalizedIntent,
            intent: intent, // For backward compatibility in tests
            domain: 'GENERAL',
            act: 'INFORM',
            mode,
            behavior: behavior,
            confidence: 1.0,
            slots: {},
            needsPlanning: false, // CRUCIAL: Bypasses LLM planning
            needsClarification: behavior === 'CLARIFY',
            reasoningShort: `Deterministic: ${reasoning}`
        };
    }

    static _directPlan(intent, domain, mode, query, reason) {
        return {
            rawIntent: intent,
            normalizedIntent: intent,
            intent,
            domain,
            act: 'INFORM',
            mode,
            confidence: 0.95,
            refinedQuery: query,
            needsPlanning: false,
            parallel: false,
            execution: [{ step: 1, tool: "LLM", purpose: reason }],
            behavior: "RESPOND",
            needsClarification: false,
            slots: {},
            reasoningShort: `Deterministic: ${reason}`
        };
    }
}

module.exports = DeterministicIntentResolver;
