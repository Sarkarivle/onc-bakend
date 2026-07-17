const { Worker } = require('bullmq');
const { getConnection, QUEUE_NAME } = require('./backgroundQueue');
const BackgroundServices = require('./backgroundServices');

let worker = null;

/**
 * Starts the worker that actually processes queued background AI tasks
 * (memory/observability/learning engines). Safe to call once per process -
 * under PM2 cluster mode every instance runs its own worker, and BullMQ's
 * Redis-based job locking makes sure a given job is only processed once
 * even with multiple workers pulling from the same queue.
 */
function startBackgroundWorker() {
    if (worker) return worker;

    worker = new Worker(QUEUE_NAME, async (job) => {
        if (job.name === 'process-interaction') {
            await BackgroundServices.processInteraction(job.data);
        }
    }, {
        connection: getConnection(),
        concurrency: Number(process.env.BACKGROUND_WORKER_CONCURRENCY || 5),
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Background job ${job?.id} (${job?.name}) failed after all retries:`, err.message);
    });

    console.log('🧵 Background AI task worker started');
    return worker;
}

async function stopBackgroundWorker() {
    if (worker) {
        await worker.close();
        worker = null;
    }
}

module.exports = { startBackgroundWorker, stopBackgroundWorker };
