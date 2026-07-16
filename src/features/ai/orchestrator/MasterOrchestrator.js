/**
 * MasterOrchestrator
 * Responsibility: Resilient Intent Mapping and Persona Protection.
 */
const LLMProvider = require('../generation/core_engine/llmProvider');
const { getToolsByCategory } = require('../tools/toolRegistry');
const AgentLoop = require('../reasoning/agentLoop');
const { getPersona, getModePrompt } = require('../prompts');

class MasterOrchestrator {
    static ALLOWED_INTENTS = [
        'JOB_SEARCH', 'MATH', 'WELLNESS', 'ROADMAP', 'SSC', 'POLICE', 'BANKING', 'UPSC',
        'GENERAL', 'UTILITY', 'DRAFTING', 'INTERVIEW', 'CONCEPT', 'SYLLABUS', 'LOCAL_SCOUT',
        'GRANTS', 'PART_TIME', 'ACADEMIC_AUDIT', 'EMAIL_PRO', 'ENGLISH_PRACTICE', 'PYQ',
        'SCAM_PROTECTOR', 'RAILWAY', 'TEACHER', 'CODING'
    ];

    static async classifyIntent(userQuery) {
        const lowerQuery = userQuery.toLowerCase().trim();
        const greetingPattern = /^(hi\b|hii+\b|hello\b|hey\b|namaste\b|ram ram\b|kaise ho\b|ji\b|bhai\b|jobo\b|good morning\b|gm\b|gn\b|good night\b)/i;
        if (greetingPattern.test(lowerQuery) && lowerQuery.split(' ').length <= 6) {
            return { intents: ['GREETING'], mood: 'NEUTRAL' };
        }

        const prompt = `Select 1-3 categories from:
['JOB_SEARCH','MATH','WELLNESS','ROADMAP','SSC','POLICE','BANKING','UPSC','GENERAL','UTILITY','DRAFTING','INTERVIEW','CONCEPT','SYLLABUS','LOCAL_SCOUT','GRANTS','PART_TIME','ACADEMIC_AUDIT','EMAIL_PRO','ENGLISH_PRACTICE','PYQ','SCAM_PROTECTOR','RAILWAY','TEACHER','CODING'].
Rules:
- "12th ke baad kya kare", "after 12th", career options, or life planning => ROADMAP.
- Do not choose PART_TIME unless the user explicitly asks internship, part-time, freelance, or earning.
- Do not choose JOB_SEARCH unless the user asks live jobs, vacancy, bharti, form, apply, salary, date, eligibility, or sarkari naukri.
Query: "${userQuery}"
Output ONLY JSON: {"intents": ["CAT1"], "mood": "NEUTRAL"}`;

        try {
            const result = await LLMProvider.generateLogic(prompt);
            const intents = this._finalizeIntents(result?.intents, lowerQuery);
            return { intents, mood: result?.mood || 'NEUTRAL' };
        } catch (e) {
            return { intents: this._finalizeIntents(['GENERAL'], lowerQuery), mood: 'NEUTRAL' };
        }
    }

    static _finalizeIntents(modelIntents = [], query = '') {
        const intents = new Set(
            (Array.isArray(modelIntents) ? modelIntents : [modelIntents])
                .map(intent => String(intent || '').toUpperCase().trim())
                .filter(intent => this.ALLOWED_INTENTS.includes(intent))
        );

        const add = (...values) => values.forEach(value => intents.add(value));
        const q = String(query || '').toLowerCase();

        if (/\bssc\b|cgl|chsl|mts|gd\b/.test(q)) add('SSC');
        if (/police|constable|daroga|si\b/.test(q)) add('POLICE');
        if (/bank|po\b|clerk|ibps|sbi|rbi/.test(q)) add('BANKING');
        if (/railway|rrb|group d|alp\b/.test(q)) add('RAILWAY', 'JOB_SEARCH');
        if (/upsc|ias|ips|civil services/.test(q)) add('UPSC');
        if (/teacher|ctet|tet\b|b\.?ed|btc/.test(q)) add('TEACHER');

        if (/job|jobs|vacancy|vacancies|sarkari|naukri|bharti|recruitment|apply link|form date|latest form/.test(q)) add('JOB_SEARCH');
        if (/fee|fees|age limit|last date|salary|qualification|eligibility|height|chest|selection process/.test(q)) add('JOB_SEARCH');
        if (/syllabus|exam pattern|previous year|pyq|mock test|practice question/.test(q)) add('SYLLABUS');
        if (/pyq|previous year/.test(q)) add('PYQ');
        if (/roadmap|study plan|master plan|kaise taiyari kare|time table|timetable/.test(q)) add('ROADMAP');
        if (/\b(10th|12th|intermediate|graduation|college)\b.*\b(baad|bad|after|kya karu|kya kare|career|options?)\b/.test(q)) add('ROADMAP');
        if (/\b(baad|bad|after|kya karu|kya kare|career|options?)\b.*\b(10th|12th|intermediate|graduation|college)\b/.test(q)) add('ROADMAP');
        if (/concept|explain|samjhao|notes|flashcard|revision/.test(q)) add('CONCEPT');

        if (/scholarship|grant|fee waiver|financial aid|yojna|scheme/.test(q)) add('GRANTS');
        if (/internship|part time|part-time|freelance|work from home/.test(q)) add('PART_TIME');
        if (/resume|cv\b|cover letter|application|sop\b|email draft|write email|leave letter/.test(q)) add('DRAFTING');
        if (/email/.test(q)) add('EMAIL_PRO');
        if (/grammar|english practice|spoken english|improve english/.test(q)) add('ENGLISH_PRACTICE');
        if (/interview|gd\b|group discussion|body language/.test(q)) add('INTERVIEW');
        if (/citation|bibliography|assignment|research paper|summarize|summary|pdf notes/.test(q)) add('ACADEMIC_AUDIT');
        if (/library|coaching|cyber cafe|exam center|near me|nearby|local/.test(q)) add('LOCAL_SCOUT');
        if (/pdf|resize|compress|ocr|image|photo|document|convert/.test(q)) add('UTILITY');
        if (/stress|anxiety|motivation|depression|exam fear|financial stress/.test(q)) add('WELLNESS');
        if (/emi|percentage|calculate|math|marks|interest/.test(q)) add('MATH');
        if (/scam|fake job|fraud|safe link|cyber safety/.test(q)) add('SCAM_PROTECTOR');
        if (/coding|programming|code likhna|python|javascript|java\b|html|css|c\+\+|dsa\b|developer ban/.test(q)) add('CODING');

        if (!/internship|part time|part-time|freelance|work from home|earning|paise|income/.test(q)) intents.delete('PART_TIME');
        if (intents.has('ROADMAP') && !/job|jobs|vacancy|vacancies|sarkari|naukri|bharti|recruitment|apply link|form date|latest form|salary|eligibility/.test(q)) {
            intents.delete('JOB_SEARCH');
        }

        if (intents.has('GENERAL') && intents.size > 1) intents.delete('GENERAL');
        if (intents.size === 0) intents.add('GENERAL');

        const ordered = Array.from(intents);
        if (ordered.includes('ROADMAP')) {
            return ['ROADMAP', ...ordered.filter(intent => intent !== 'ROADMAP')].slice(0, 4);
        }
        return ordered.slice(0, 4);
    }

    static _selectTools(userMessage, intents = []) {
        const q = String(userMessage || '').toLowerCase();
        const upper = (intents || []).map(i => String(i).toUpperCase());
        const liveToolQuery = /latest|new|nayi|aayi|aaya|job|jobs|vacancy|sarkari|naukri|bharti|recruitment|apply|form|deadline|last date|scholarship|grant|internship|part time|near me|nearby|local|library|coaching|cyber cafe/.test(q);

        if (upper.includes('GREETING') || upper.includes('GENERAL')) return [];
        if (upper.includes('ROADMAP') && !liveToolQuery) return [];
        if (upper.includes('CAREER_ADVICE') && !liveToolQuery) return [];

        return getToolsByCategory(intents);
    }

    static async processUserQuery(userMessage, chatHistory, context) {
        const { intents, mood } = context.image_url ? { intents: ['UTILITY'], mood: 'NEUTRAL' } : await this.classifyIntent(userMessage);
        const selectedTools = this._selectTools(userMessage, intents);
        // Computed once here so persona assembly, mode prompts, and the output contract
        // in AgentLoop.run all agree on the same depth — a narrow query shouldn't get the
        // full planning template from one part of the prompt and a "keep it short" note
        // from another.
        const depth = AgentLoop._responseDepth(userMessage, intents);

        const basePersona = getPersona(context.profile?.name, intents.includes('GREETING'), mood, intents, depth);
        const capabilities = getModePrompt(intents, context.profile, depth);

        const finalPrompt = `${capabilities}\n\n${basePersona}`;
        return await AgentLoop.run(userMessage, chatHistory, context, finalPrompt, selectedTools, intents, context.onToken || null, depth);
    }
}

module.exports = MasterOrchestrator;
