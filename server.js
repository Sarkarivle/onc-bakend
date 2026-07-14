const mongoose = require('mongoose');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const SmartGateway = require('./src/features/ai/quality/smartGateway');
const { initRedis, getRedis } = require('./src/config/redis');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// 1. DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Ultra Secure Modular DB Connection Established');

    await initRedis();
    const redis = getRedis();

    if (redis) {
        // Setup Redis Pub/Sub for Real-time Scaling
        const subscriber = redis.duplicate();
        await subscriber.connect();

        await subscriber.subscribe('feed_updates', (message) => {
            const update = JSON.parse(message);
            io.emit('post_update', update); // Broadcast to all connected mobile users
        });
        console.log('📡 Real-time Engine: Redis Pub/Sub Active');
    }

    try { await SmartGateway.initialize(); } catch (err) {}
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

// Attach io to app to use in controllers
app.set('io', io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SERVER RUNNING ON PORT: ${PORT} (Real-time Enabled)`);
});
