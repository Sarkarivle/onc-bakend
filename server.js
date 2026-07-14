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
    // Attach io to app
    app.set('io', io);
} catch (e) {
    console.error('⚠️ Real-time Engine (socket.io) not installed. Run: npm install socket.io');
}

const server = io ? http.createServer(app) : app;

// 1. DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Ultra Secure Modular DB Connection Established');

    await initRedis();
    const redis = getRedis();

    if (redis && io) {
        try {
            const subscriber = redis.duplicate();
            await subscriber.connect();

            await subscriber.subscribe('feed_updates', (message) => {
                const update = JSON.parse(message);
                io.emit('post_update', update);
            });
            console.log('📡 Real-time Engine: Redis Pub/Sub Active');
        } catch (err) {
            console.error('❌ Redis Pub/Sub Error:', err.message);
        }
    }

    try { await SmartGateway.initialize(); } catch (err) {}
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

const PORT = process.env.PORT || 3001;
const finalServer = io ? server : app;

if (io) {
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Real-time Enabled)`);
    });
} else {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Real-time Disabled)`);
    });
}
