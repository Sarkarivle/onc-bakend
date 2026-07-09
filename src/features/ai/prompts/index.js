const getPersona = require('./persona');
const getFormatting = require('./formatting');
const jobMode = require('./modes/jobMode');
const adviceMode = require('./modes/adviceMode');
const wellnessMode = require('./modes/wellnessMode');
const mathMode = require('./modes/mathMode');
const utilityMode = require('./modes/utilityMode');

const getModePrompt = (intent) => {
    const modes = {
        'JOB_SEARCH': jobMode(),
        'CAREER_ADVICE': adviceMode(),
        'WELLNESS': wellnessMode(),
        'MATH': mathMode(),
        'UTILITY': utilityMode(),
        'GENERAL': `# MODE: CONVERSATIONAL\nKeep it friendly, short, and helpful. Ask how their preparation is going.`
    };
    return modes[intent] || modes['GENERAL'];
};

module.exports = { getPersona, getFormatting, getModePrompt };
