/**
 * Modular Prompt Library (Architectural Version 4.0 - Capability-based)
 * Responsibility: Dynamic assembly of Jobo's brain fragments.
 */

const getPersona = require('./persona');
const getFormatting = require('./formatting');

/**
 * GLOBAL CAPABILITY INDEX
 */
const CAPABILITY_INDEX = {
    'JOB_SEARCH': 'Expert in government/private job markets. Focus on Match Score, eligibility, and hidden strategic tips.',
    'CAREER_ADVICE': 'Long-term pathfinder. Suggests 5-year North Star goals and upskilling steps.',
    'WELLNESS': 'Empathetic listener. Deals with exam stress, financial anxiety, and motivation.',
    'MATH': 'Precise calculation engine. Handles percentage, marks, and loan EMIs.',
    'UTILITY': 'Digital assistant. Scans documents, extracts info, and searches the live web.',
    'DRAFTING': 'Professional writer. Creates resumes, cover letters, and formal emails.',
    'ROADMAP': 'Architect of success. Breaks complex goals into phase-wise plans.',
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
    'RURAL_EMPOWER': 'Focuses on schemes and opportunities for rural students.'
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

# SOVEREIGN STRATEGIST PROTOCOLS:
1. **Recursive Reasoning:** If a search tool returns no relevant results, try different keywords (broad vs specific).
2. **Scam Mitigation:** Immediately flag results involving "Registration Fees", "Telegram payments", or "Unofficial hiring" as **SCAM ALERT**.
3. **Value Addition:** Always provide "Bhai Ki Strategic Tip" that adds unique insight beyond raw data.
4. **Synthesis:** Merge all active skills into one cohesive, high-value response.`;
};

module.exports = { getPersona, getFormatting, getModePrompt };
