const core = require('./prompts/core');
const learning = require('./prompts/learning');
const intelligence = require('./prompts/intelligence');
const search = require('./prompts/search');
const execution = require('./prompts/execution');
const output = require('./prompts/output');
const context = require('./prompts/context');

module.exports = {
    CORE: core,
    LEARNING: learning,
    INTELLIGENCE: intelligence,
    SEARCH: search,
    EXECUTION: execution,
    OUTPUT: output,
    CONTEXT: context
};
