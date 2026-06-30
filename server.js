const mongoose = require('mongoose');
require('dotenv').config();
const app = require('./src/app');
const SmartGateway = require('./src/features/ai/quality/smartGateway');

// 1. DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ Ultra Secure Modular DB Connection Established');

    // Initialize AI Clusters
    try {
        await SmartGateway.initialize();
    } catch (err) {
        console.error('❌ AI Initialization Error:', err.message);
    }
  })
  .catch(err => console.error('❌ DB Connection Error:', err));

// 2. SERVER START
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log('----------------------------------------------');
    console.log(`🚀 SERVER RUNNING ON PORT: ${PORT}`);
    console.log(`🔗 ACCESS LOCALLY: http://localhost:${PORT}`);
    console.log(`🔗 ACCESS VIA IP: http://72.61.170.181:${PORT}`);
    console.log('----------------------------------------------');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use.`);
    } else {
        console.error('❌ Server Error:', err);
    }
});
