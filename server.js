const mongoose = require('mongoose');
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const SmartGateway = require('./src/features/ai/quality/smartGateway');
const { initRedis, getRedis } = require('./src/config/redis');
const analytics = require('./src/services/analyticsService');
const chatSocket = require('./src/features/chat/chatSocket');
const { createAdapter } = require('@socket.io/redis-adapter');

let io = null;
let serverInstance = null;
try {
    const { Server } = require('socket.io');
    serverInstance = http.createServer(app);
    io = new Server(serverInstance, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    app.set('io', io);
    analytics.init(io);
    chatSocket(io);
} catch (e) {
    console.error('⚠️ socket.io not loaded.');
    serverInstance = app;
}

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
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
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const PORT = process.env.PORT || 3001;

if (io) {
    serverInstance.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Real-time Enabled)`);
    });
} else {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Normal Mode)`);
    });
}
