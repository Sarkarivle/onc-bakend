require('dotenv').config();

const { validateEnv } = require('./src/config/validateEnv');
validateEnv();

const { initSentry, Sentry } = require('./src/config/sentry');
initSentry(); // Must run before other modules are required for auto-instrumentation to work.

const mongoose = require('mongoose');
const http = require('http');
const app = require('./src/app');
const SmartGateway = require('./src/features/ai/quality/smartGateway');
const { initRedis, getRedis } = require('./src/config/redis');
const analytics = require('./src/services/analyticsService');
const chatSocket = require('./src/features/chat/chatSocket');
const { createAdapter } = require('@socket.io/redis-adapter');
const { startBackgroundWorker, stopBackgroundWorker } = require('./src/features/ai/orchestrator/backgroundWorker');

let io = null;
let serverInstance = null;
try {
    const { Server } = require('socket.io');
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const socketAllowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    // Native mobile Socket.io clients don't send a browser Origin, so this only
    // restricts browser-based connections (e.g. a rogue site opening a socket).
    const socketCorsOrigin = NODE_ENV === 'production'
        ? (socketAllowedOrigins.length > 0 ? socketAllowedOrigins : false)
        : '*';
    serverInstance = http.createServer(app);
    io = new Server(serverInstance, {
      cors: { origin: socketCorsOrigin, methods: ["GET", "POST"] }
    });
    app.set('io', io);
    analytics.init(io);
    chatSocket(io);
} catch (e) {
    console.error('⚠️ socket.io not loaded.');
    serverInstance = app;
}

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

// Default maxPoolSize (100) is shared across ALL Mongo traffic from this
// process - API requests, admin dashboard aggregates, socket.io chat, and
// background scripts all draw from the same pool. Tune via env per deployment
// (e.g. lower per-instance size once running multiple clustered instances,
// so the sum across instances stays under what the Mongo deployment allows).
mongoose.connect(mongoURI, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 100),
    minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
})
  .then(async () => {
    console.log('✅ Ultra Secure Modular DB Connection Established');

    // 1. Init Redis first (Non-blocking)
    initRedis().then(async () => {
        const redis = getRedis();
        if (redis && io) {
            try {
                // Clear ghost online users on startup
                await redis.del('online_users');
                console.log('🧹 Redis Online Users Cleared');

                // Setup Redis Adapter for Socket.io scaling
                const pubClient = redis;
                const subClient = redis.duplicate();
                await subClient.connect();
                io.adapter(createAdapter(pubClient, subClient));
                console.log('🔄 Socket.io Redis Adapter Enabled');

                const subscriber = redis.duplicate();
                await subscriber.connect();
                await subscriber.subscribe('feed_updates', (message) => {
                    console.log('📢 Redis Broadcast:', message);
                    io.emit('post_update', JSON.parse(message));
                });
            } catch (err) {
                console.error('❌ Redis Subscribe Error:', err);
            }
        }
    });

    // 2. Init AI Clusters
    try { await SmartGateway.initialize(); } catch (err) {}

    // 3. Start processing queued background AI tasks (memory/observability/learning)
    try { startBackgroundWorker(); } catch (err) { console.error('❌ Background worker failed to start:', err.message); }
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const activeServer = io ? serverInstance : app;

const server = activeServer.listen(PORT, HOST, () => {
    console.log(`🚀 SERVER RUNNING ON ${HOST}:${PORT} (${io ? 'Real-time Enabled' : 'Normal Mode'})`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Backend port busy: ${HOST}:${PORT}`);
        console.error('   Fix: stop the duplicate PM2/process using this port, or set a different PORT in PM2/.env.');
        process.exit(1);
    }

    console.error('❌ Server startup error:', err);
    process.exit(1);
});

// Without this, a PM2 restart/deploy hard-kills whatever is in flight -
// dropped chat messages, truncated AI streams, half-written DB writes.
// PM2's kill_timeout (ecosystem.config.js) is 10s, so this must finish well
// before that or PM2 SIGKILLs the process anyway.
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.set('isShuttingDown', true);
    console.log(`\n🛑 ${signal} received - draining before shutdown...`);

    const forceExitTimer = setTimeout(() => {
        console.error('❌ Graceful shutdown timed out - forcing exit.');
        process.exit(1);
    }, 8000);
    forceExitTimer.unref();

    try {
        if (io) {
            io.close();
            console.log('🔌 Socket.io connections closed');
        }

        // Let the background worker finish its current job (if any) before
        // Redis/Mongo close below, so a job doesn't get cut off mid-write.
        await stopBackgroundWorker();
        console.log('🧵 Background worker stopped');

        await new Promise((resolve) => server.close(resolve));
        console.log('🚪 HTTP server stopped accepting new connections');

        await mongoose.connection.close(false);
        console.log('🗄️  MongoDB connection closed');

        const redis = getRedis();
        if (redis) {
            await redis.quit().catch(() => {});
            console.log('📮 Redis connection closed');
        }

        clearTimeout(forceExitTimer);
        console.log('✅ Graceful shutdown complete');
        await Sentry.close(2000).catch(() => {});
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during graceful shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// These would otherwise crash the process silently (or with only a console
// stack trace that scrolls away) - report to Sentry first so it's not
// invisible in production, then let PM2 restart the process as usual.
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    Sentry.captureException(err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
