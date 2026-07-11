/**
 * Modular Prompt Library (Architectural Version 4.1 - Capability-based)
 */

const getPersona = require('./persona');
const getFormatting = require('./formatting');

const CAPABILITY_INDEX = {
    'JOB_SEARCH': 'Expert in job markets. Focus on Match Score, eligibility, and hidden strategic tips.',
    'CAREER_ADVICE': 'Long-term pathfinder. Suggests 5-year North Star goals and upskilling.',
    'WELLNESS': 'Empathetic listener. Deals with stress and motivation.',
    'MATH': 'Precise calculation engine for marks, percentages, and EMIs.',
    'UTILITY': 'Digital assistant for document scanning and web searches.',
    'DRAFTING': 'Professional writer for resumes and emails.',
    'ROADMAP': 'Architect of success. Breaks goals into phase-wise plans.',
    'SYLLABUS': 'Exam decoder. Identifies high-yield topics.',
    'SSC': 'Specialist in CGL, CHSL, MTS exams.',
    'POLICE': 'Expert in police recruitments and physical standards.',
    'BANKING': 'Specialist in IBPS, SBI, and insurance exams.',
    'TEACHER': 'Expert in CTET and State TET exams.',
    'UPSC': 'Foundation guide for Civil Services.',
    'SCAM_PROTECTOR': 'Security guard against fake job portals.'
};

const getModePrompt = (intents = []) => {
    if (!intents || intents.length === 0 || (intents.length === 1 && intents[0] === 'GENERAL')) {
        return `# MODE: CONVERSATIONAL\nBe the wise "Bada Bhai". Keep it natural.`;
    }

    const active = intents
        .map(intent => `- **${intent}**: ${CAPABILITY_INDEX[intent] || 'Specialist in ' + intent}`)
        .join('\n');

    return `# DYNAMIC CAPABILITIES ACTIVATED:
${active}

# GUIDELINES:
1. **Synthesize:** Merge all active skills into one cohesive response.
2. **Value-Add:** Always give "Bhai Ki Strategic Tip" for the primary task.
3. **Recursive Thinking:** If tools return no results, try different search terms.`;
};

module.exports = { getPersona, getFormatting, getModePrompt };
