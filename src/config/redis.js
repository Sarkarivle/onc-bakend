const { createClient } = require('redis');

let redisClient = null;

const initRedis = async () => {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
        });

        redisClient.on('error', (err) => console.log('Redis Client Error', err));

        await redisClient.connect();
        console.log('✅ REDIS CONNECTED: Scaling Engine Ready');
    } catch (e) {
        console.log('⚠️ REDIS NOT FOUND: Falling back to Local Memory Cache');
        redisClient = null;
    }
};

const getRedis = () => redisClient;

module.exports = { initRedis, getRedis };
