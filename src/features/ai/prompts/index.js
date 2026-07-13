/**
 * Modular Prompt Library (v5.0 - Truly Dynamic Gemini Architecture)
 * Responsibility: Intent-based Mode Loading and Capability Activation.
 */

const getPersona = require('./persona');
const getFormatting = require('./formatting');

// Mapping Intents to their full expert mode files
const MODE_FILE_MAP = {
    'JOB_SEARCH': 'jobMode',
    'CAREER_ADVICE': 'adviceMode',
    'WELLNESS': 'wellnessMode',
    'MATH': 'mathMode',
    'UTILITY': 'utilityMode',
    'DRAFTING': 'draftingMode',
    'ROADMAP': 'architectMode',
    'SYLLABUS': 'syllabusMode',
    'SSC': 'sscExpertMode',
    'POLICE': 'policeExpertMode',
    'BANKING': 'bankingExpertMode',
    'TEACHER': 'teacherExpertMode',
    'UPSC': 'upscFoundationMode',
    'SCAM_PROTECTOR': 'scamProtectorMode',
    'PYQ': 'pyqMode',
    'CONCEPT': 'conceptMode',
    'SHORTCUT': 'shortcutMode',
    'GK_DIGEST': 'gkDigestMode',
    'MNEMONIC': 'mnemonicMode',
    'INTERVIEW': 'interviewMode',
    'PIVOT': 'pivotMode',
    'JD_DECODER': 'jdDecoderMode'
};

const REQUIREMENT_MAP = {
    'POLICE': ['height', 'chest', 'gender', 'state'],
    'JOB_SEARCH': ['qualification', 'dob', 'state', 'category'],
    'ROADMAP': ['qualification', 'dob', 'state'],
    'TEACHER': ['professionalDegrees', 'state'],
    'DEFENSE': ['height', 'gender', 'dob'],
    'SSC': ['qualification', 'state']
};

const getModePrompt = (intents = [], profile = {}) => {
    if (!intents || intents.length === 0 || (intents.length === 1 && intents[0] === 'GENERAL')) {
        return `# MODE: CONVERSATIONAL\nBe the wise "Bada Bhai". Keep it natural.`;
    }

    // 1. Load Full Expert Mode Contents
    const expertContents = intents
        .map(intent => {
            const fileName = MODE_FILE_MAP[intent];
            if (fileName) {
                try {
                    const modeFn = require(`./modes/${fileName}`);
                    return modeFn();
                } catch (e) {
                    return `- **${intent}**: Specialist expert mode active.`;
                }
            }
            return `- **${intent}**: Specialist capability active.`;
        })
        .join('\n\n');

    // 2. Detect Missing Context for Active Intents
    let contextMissing = [];
    intents.forEach(intent => {
        if (REQUIREMENT_MAP[intent]) {
            const missing = REQUIREMENT_MAP[intent].filter(field => !profile[field]);
            contextMissing.push(...missing);
        }
    });
    contextMissing = [...new Set(contextMissing)];

    const gapInstruction = contextMissing.length > 0
        ? `\n# MISSING USER CONTEXT (CRITICAL):
The user wants info regarding ${intents.join(', ')}, but database is missing: ${contextMissing.join(', ')}.
**INSTRUCTION:** Ask for these details warmly before giving a final verdict.`
        : "";

    return `
# DYNAMIC EXPERTISE ACTIVATED:
${expertContents}

${gapInstruction}

# INTEGRATION GUIDELINES:
1. **Synthesize:** Merge the above expert modes into one cohesive "Bada Bhai" response.
2. **Prioritize:** If multiple modes are active, focus on the user's primary intent first.
3. **Value-Add:** Always include one "Bhai Ki Strategic Tip".
`.trim();
};

module.exports = { getPersona, getFormatting, getModePrompt };
