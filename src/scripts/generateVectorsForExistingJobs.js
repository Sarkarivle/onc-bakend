const mongoose = require('mongoose');
const Job = require('../features/jobs/jobModel');
const VectorService = require('../features/ai/knowledge/vectorService');
const Settings = require('../features/settings/settingsModel');

// Manual connection for script
const MONGO_URI = "mongodb+srv://himanshu:himanshu@cluster0.zwtv3.mongodb.net/onc?retryWrites=true&w=majority";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB...");

        const jobs = await Job.find({
            $or: [
                { searchVector: { $exists: false } },
                { searchVector: { $size: 0 } }
            ]
        });

        console.log(`Found ${jobs.length} jobs without vectors.`);

        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            console.log(`[${i+1}/${jobs.length}] Generating vector for: ${job.title}`);

            const textToEmbed = VectorService.createJobText(job);
            const vector = await VectorService.generate(textToEmbed);

            if (vector) {
                job.searchVector = vector;
                await job.save();
                console.log("✅ Saved.");
            } else {
                console.log("❌ Failed to generate vector.");
            }

            // Simple throttle to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("All done!");
        process.exit(0);
    } catch (err) {
        console.error("Critical Error:", err);
        process.exit(1);
    }
}

run();
