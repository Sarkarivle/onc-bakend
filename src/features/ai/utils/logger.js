// Re-exports the app-wide structured logger (src/utils/logger.js) so
// existing `require('../utils/logger')` call sites in the AI feature keep
// working unchanged.
module.exports = require('../../../utils/logger');
