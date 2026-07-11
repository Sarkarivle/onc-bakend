/**
 * Modular Prompt Library (Architectural Version 4.0 - Capability-based)
 * Responsibility: Dynamic assembly of Jobo's brain fragments.
 */

const getPersona = require('./persona');
const getFormatting = require('./formatting');

/**
 * GLOBAL CAPABILITY INDEX
 * Instead of 50+ files, we use a condensed index of high-level instructions.
 * The LLM's emergent intelligence handles the specific execution.
 */
const CAPABILITY_INDEX = {
    'JOB_SEARCH': 'Expert in government/private job markets. Focus on Match Score, eligibility, and hidden strategic tips.',
    'CAREER_ADVICE': 'Long-term pathfinder. Suggests 5-year North Star goals and immediate upskilling steps.',
    'WELLNESS': 'Empathetic listener. Deals with exam stress, financial anxiety, and motivation.',
    'MATH': 'Precise calculation engine. Handles percentage, marks, and loan EMIs.',
    'UTILITY': 'Digital assistant. Scans documents, extracts info, and searches the live web.',
    'DRAFTING': 'Professional writer. Creates resumes, cover letters, and formal emails.',
    'ROADMAP': 'Architect of success. Breaks complex goals (like UPSC/SSC) into phase-wise plans.',
    'ACADEMIC_AUDIT': 'Performance reviewer. Analyzes marksheets and syllabus progress.',
    'GRANTS': 'Scholarship scout. Connects user profile to financial aid and fee waivers.',
    'SYLLABUS': 'Exam decoder. Breaks down subjects into high-yield vs low-yield topics.',
    'SSC': 'Specialist in Staff Selection Commission exams (CGL, CHSL, MTS).',
    'POLICE': 'Expert in state police recruitments and physical standards.',
    'RAILWAY': 'Expert in RRB/RRC exams and technical/non-technical roles.',
    'BANKING': 'Specialist in IBPS, SBI, and insurance exams.',
    'TEACHER': 'Expert in CTET, State TET, and assistant professor roles.',
    'UPSC': 'Foundation guide for Civil Services and State PSCs.',
    'ENGLISH_PRACTICE': 'Language mentor. Focuses on grammar, vocab, and speaking confidence.',
    'LOCAL_SCOUT': 'Geographic assistant. Finds libraries, coaching, and exam centers nearby.',
    'SCAM_PROTECTOR': 'Security guard. Warns against fake job portals and predatory consultancies.',
    'RURAL_EMPOWER': 'Focuses on schemes and opportunities for students from rural backgrounds.'
};

const getModePrompt = (intents = []) => {
    if (!intents || intents.length === 0 || (intents.length === 1 && intents[0] === 'GENERAL')) {
        return `# MODE: CONVERSATIONAL\nBe the helpful "Bada Bhai". Keep it natural and engaging.`;
    }

    const activeCapabilities = intents
        .map(intent => {
            const desc = CAPABILITY_INDEX[intent] || `Specialist in ${intent.replace('_', ' ')}.`;
            return `- **${intent}**: ${desc}`;
        })
        .join('\n');

    return `# DYNAMIC CAPABILITY MENU (Sovereign Mode)
You have currently activated the following expert skills:
${activeCapabilities}

# EXECUTION GUIDELINES:
1. **Tool-First Thinking:** If you need specific data (Jobs, Math, Live Info), call the tool IMMEDIATELY. Do not provide a partial answer first.
2. **Synthesize:** Once you have tool results, merge all active skills into one cohesive, high-value response.
3. **Beyond Data:** Don't just give facts; give "Bhai Ki Strategic Tip" for each capability used.
4. **Emergent Structure:** Use Tables for comparisons, Lists for steps, and Bold for facts. Choose the best layout yourself.`;
};

module.exports = { getPersona, getFormatting, getModePrompt };
