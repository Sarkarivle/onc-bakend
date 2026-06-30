/**
 * Backward-compatible AI service entrypoint.
 *
 * Existing routes and clients import `features/ai/aiService`, while the current
 * implementation lives in `orchestrator/aiOrchestrator`. Keeping this facade
 * avoids changing any public API or route wiring during the migration.
 */
module.exports = require('./orchestrator/aiOrchestrator');
