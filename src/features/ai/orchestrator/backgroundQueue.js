const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'ai-background-tasks';

// BullMQ needs its own ioredis connection - separate from this project's
// `redis` (node-redis v4) client used everywhere else for caching/rate-limiting.
// maxRetriesPerRequest: null is required by BullMQ so it can manage retries itself.
let connection = null;
let queue = null;

function getConnection() {
    if (!connection) {
        connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
            maxRetriesPerRequest: null,
        });
        connection.on('error', (err) => {
            console.error('⚠️ BullMQ Redis connection error:', err.message);
        });
    }
    return connection;
}

function getQueue() {
    if (!queue) {
        queue = new Queue(QUEUE_NAME, { connection: getConnection() });
    }
    return queue;
}

/**
 * Enqueues a durable background task (survives a process crash/restart -
 * it lives in Redis, not process memory, until a worker picks it up and
 * BullMQ retries on failure). If Redis/BullMQ is unreachable, falls back to
 * running it inline best-effort (the old fire-and-forget behavior) after a
 * short timeout, so a queue outage degrades instead of hanging the request
 * that triggered this or silently dropping the task.
 */
async function enqueueBackgroundTask(taskType, payload, inlineFallback) {
    try {
        await Promise.race([
            getQueue().add(taskType, payload, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: { age: 3600, count: 1000 },
                removeOnFail: { age: 86400 },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('enqueue timed out')), 2000)),
        ]);
    } catch (err) {
        console.error(`⚠️ Failed to enqueue background task "${taskType}" (${err.message}) - running inline instead.`);
        if (inlineFallback) {
            inlineFallback().catch(e => console.error(`❌ Inline fallback for "${taskType}" also failed:`, e.message));
        }
    }
}

module.exports = { getQueue, getConnection, enqueueBackgroundTask, QUEUE_NAME };
