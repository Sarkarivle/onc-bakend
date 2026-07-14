const mongoose = require('mongoose');
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const SmartGateway = require('./src/features/ai/quality/smartGateway');
const { initRedis, getRedis } = require('./src/config/redis');

let io = null;
try {
    const { Server } = require('socket.io');
    const server = http.createServer(app);
    io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    app.set('io', io);
} catch (e) {
    console.error('⚠️ socket.io not loaded.');
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
                const subscriber = redis.duplicate();
                await subscriber.connect();
                await subscriber.subscribe('feed_updates', (message) => {
                    io.emit('post_update', JSON.parse(message));
                });
            } catch (err) {}
        }
    });

    // 2. Init AI Clusters
    try { await SmartGateway.initialize(); } catch (err) {}
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const PORT = process.env.PORT || 3001;
const serverInstance = io ? http.createServer(app) : app;

if (io) {
    serverInstance.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Real-time Enabled)`);
    });
} else {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Normal Mode)`);
    });
}
