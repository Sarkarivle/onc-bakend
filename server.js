const mongoose = require('mongoose');
require('dotenv').config();
const app = require('./src/app');

// 1. DATABASE CONNECTION
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Ultra Secure Modular DB Connection Established'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// 2. SERVER START
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Modular Server active on port ${PORT}`);
});
