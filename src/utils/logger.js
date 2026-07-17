/**
 * Structured (JSON) logger, safe for log aggregators (ELK/Loki/CloudWatch)
 * that expect one JSON object per line rather than free-form text - which
 * is what nearly all of this codebase's ~190 console.log/console.error
 * calls currently produce. New code (and anything touched going forward)
 * should log through this instead of console.* directly.
 */
const logger = {
    info: (message, meta = {}) => {
        console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message, ...meta }));
    },
    error: (message, error = {}, meta = {}) => {
        console.error(JSON.stringify({
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            message,
            error: error.message || error,
            stack: error.stack,
            ...meta
        }));
    },
    warn: (message, meta = {}) => {
        console.warn(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), message, ...meta }));
    },
    debug: (message, meta = {}) => {
        if (process.env.DEBUG === 'true') {
            console.debug(JSON.stringify({ level: 'DEBUG', timestamp: new Date().toISOString(), message, ...meta }));
        }
    }
};

module.exports = logger;
