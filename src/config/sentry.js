const Sentry = require('@sentry/node');

let initialized = false;

/**
 * Initializes Sentry error tracking if SENTRY_DSN is set. Without it, this
 * is a no-op - errors still go to the console/structured logger, they just
 * won't page anyone or show up in a dashboard. Must be called as early as
 * possible (before other modules are required) for Sentry's automatic
 * instrumentation to work.
 */
function initSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.log('ℹ️  SENTRY_DSN not set - Sentry error tracking disabled (errors still logged to console).');
        return false;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    initialized = true;
    console.log('✅ Sentry error tracking initialized');
    return true;
}

function isSentryInitialized() {
    return initialized;
}

module.exports = { Sentry, initSentry, isSentryInitialized };
