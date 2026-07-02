/**
 * Production-grade Logger for AI Features.
 * Uses structured console output for ELK/Loki-compatible collection.
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
