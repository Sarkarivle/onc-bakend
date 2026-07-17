// Fails fast with one clear message instead of a confusing stack trace deep
// in some module's require chain (e.g. JWT_SECRET currently throws from
// src/config/jwt.js the first time anything requires it - correct, but the
// error is easier to act on if it's the very first thing printed at boot).
const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'];

function validateEnv() {
    const missing = REQUIRED_VARS.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
        console.error('   Copy .env.example to .env and fill these in before starting the server.');
        process.exit(1);
    }

    const recommended = [];
    if (!process.env.REDIS_URL) {
        recommended.push('REDIS_URL - rate limiting, AI caching, auth caching, and the background job queue will fall back to per-instance, non-shared behavior without it.');
    }
    if ((process.env.NODE_ENV || 'development') === 'production' && !process.env.CORS_ORIGINS) {
        recommended.push('CORS_ORIGINS - in production, all browser cross-origin requests are blocked by default without this.');
    }
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.LLM_BASE_URL) {
        recommended.push('GROQ_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / LLM_BASE_URL - no LLM provider is configured, AI features will fail.');
    }
    if (!process.env.SENTRY_DSN) {
        recommended.push('SENTRY_DSN - error tracking is disabled; errors only go to console logs.');
    }

    if (recommended.length > 0) {
        console.warn('⚠️  Missing recommended environment variable(s):');
        recommended.forEach(msg => console.warn(`   - ${msg}`));
    }
}

module.exports = { validateEnv };
