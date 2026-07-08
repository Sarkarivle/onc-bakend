const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Settings = require('./src/features/settings/settingsModel');

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

async function fix() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to DB');

    const groqKey = await Settings.findOne({ key: 'GROQ_API_KEY' });
    const searchKey = "1NTpGY5PXu2C3ZcLZDK56bDZ";

    if (!groqKey) {
      console.error('GROQ_API_KEY not found in DB!');
      process.exit(1);
    }

    const envContent = `PORT=3001
MONGO_URI=${mongoURI}
SEARCH_API_KEY=${searchKey}
GROQ_API_KEY=${groqKey.value}
`;

    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('.env file updated successfully with key from DB');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fix();
