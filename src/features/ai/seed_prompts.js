const mongoose = require('mongoose');
const PromptModule = require('./prompts/promptModel');
const localRegistry = require('./moduleRegistry');

// Database connection (Update with your actual MongoDB URI)
const MONGO_URI = "your_mongodb_connection_string_here";

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for seeding...");

        const modulesToSeed = ['CORE', 'PERSONALITY', 'OUTPUT', 'HALLUCINATION_PREVENTION', 'LANGUAGE', 'INTELLIGENCE'];

        for (const key of modulesToSeed) {
            const exists = await PromptModule.findOne({ key, isDefault: true });
            if (!exists && localRegistry[key]) {
                await PromptModule.create({
                    key,
                    version: '1.0.0',
                    content: typeof localRegistry[key] === 'string' ? localRegistry[key] : "Default Module Content",
                    isDefault: true,
                    isActive: true,
                    updatedBy: 'System Architect'
                });
                console.log(`✅ Seeded default prompt for: ${key}`);
            }
        }

        console.log("\n🚀 Seeding complete! Your AI is now dynamic.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding failed:", err.message);
        process.exit(1);
    }
}

seed();
