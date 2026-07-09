const getPersona = require('./persona');
const getFormatting = require('./formatting');
const careerMode = require('./modes/careerMode');
const wellnessMode = require('./modes/wellnessMode');
const mathMode = require('./modes/mathMode');
const utilityMode = require('./modes/utilityMode');

const getModePrompt = (intent) => {
    const modes = {
        'CAREER': careerMode(),
        'WELLNESS': wellnessMode(),
        'MATH': mathMode(),
        'UTILITY': utilityMode(),
        'GENERAL': `# MODE: CONVERSATIONAL\nKeep it friendly, short, and helpful. Ask how their preparation is going.`
    };
    return modes[intent] || modes['GENERAL'];
};

module.exports = { getPersona, getFormatting, getModePrompt };
