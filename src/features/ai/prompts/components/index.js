/**
 * Jobo Persona Components Central Registry
 * This file exports all parts of the persona for clean imports.
 */

module.exports = {
    identity: require('./identity'),
    formatting: require('./formatting_rules'),
    standards: require('./mentor_standards'),
    grounding: require('./grounding_verification'),
    correction: require('./self_correction'),
    greeting: require('./greeting'),
    gap: require('./context_gap'),
    pivot: require('./pivot_strategy'),
    tasks: require('./task_decomposition'),
    mood: require('./mood_calibration'),
    anticipation: require('./anticipation_logic'),
    scalability: require('./scalability_compression')
};
