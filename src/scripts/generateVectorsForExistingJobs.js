const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Job = require('../features/jobs/jobModel');
const VectorService = require('../features/ai/knowledge/vectorService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs(argv) {
    const options = {
        dryRun: argv.includes('--dry-run'),
        force: argv.includes('--force'),
        limit: Number(getArgValue(argv, '--limit') || 0),
        batch: Number(getArgValue(argv, '--batch') || 25),
        delayMs: Number(getArgValue(argv, '--delay-ms') || 0)
    };

    if (!Number.isFinite(options.limit) || options.limit < 0) options.limit = 0;
    if (!Number.isFinite(options.batch) || options.batch <= 0) options.batch = 25;
    if (!Number.isFinite(options.delayMs) || options.delayMs < 0) options.delayMs = 0;
    return options;
}

function getArgValue(argv, name) {
    const index = argv.indexOf(name);
    if (index === -1) return null;
    return argv[index + 1] || null;
}

function buildQuery(options, providerId) {
    if (options.force) return { isActive: true };
    return {
        isActive: true,
        $or: [
            { searchVector: { $exists: false } },
            { searchVector: { $size: 0 } },
            { searchVectorProvider: { $ne: providerId } },
            { searchVectorGeneratedAt: { $exists: false } }
        ]
    };
}

async function countMatchingJobs(query) {
    return await Job.countDocuments(query);
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error('MONGO_URI is required. Refusing to run vector backfill without an environment-provided database URL.');
    }

    const providerInfo = VectorService.getProviderInfo();
    const providerId = `${providerInfo.provider}:${providerInfo.model}`;
    const query = buildQuery(options, providerId);

    console.log('🔎 Job vector backfill starting...');
    console.log(`Provider: ${providerId}`);
    console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'WRITE'}${options.force ? ' + FORCE' : ''}`);

    await mongoose.connect(mongoUri);
    await VectorService.init();

    const total = await countMatchingJobs(query);
    const maxToProcess = options.limit > 0 ? Math.min(options.limit, total) : total;
    console.log(`Matching active jobs: ${total}`);
    console.log(`Will process: ${maxToProcess}`);

    if (options.dryRun || maxToProcess === 0) {
        await mongoose.disconnect();
        console.log('✅ Dry run complete.');
        return;
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    while (processed < maxToProcess) {
        const remaining = maxToProcess - processed;
        const jobs = await Job.find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(Math.min(options.batch, remaining));

        if (jobs.length === 0) break;

        for (const job of jobs) {
            processed++;
            try {
                const textToEmbed = VectorService.createJobText(job);
                const vector = await VectorService.generate(textToEmbed);

                if (!Array.isArray(vector) || vector.length === 0) {
                    failed++;
                    console.warn(`⚠️ [${processed}/${maxToProcess}] Empty vector: ${job.title}`);
                    continue;
                }

                job.searchVector = vector;
                job.searchVectorProvider = providerId;
                job.searchVectorGeneratedAt = new Date();
                job.searchVectorTextHash = VectorService.textHash(textToEmbed);
                await job.save();
                updated++;

                console.log(`✅ [${processed}/${maxToProcess}] Indexed: ${job.title} (${vector.length} dims)`);
            } catch (error) {
                failed++;
                console.error(`❌ [${processed}/${maxToProcess}] ${job.title}: ${error.message}`);
            }

            if (options.delayMs > 0) await sleep(options.delayMs);
        }
    }

    await mongoose.disconnect();
    console.log('============================================================');
    console.log('JOB VECTOR BACKFILL COMPLETE');
    console.log(`Processed: ${processed}`);
    console.log(`Updated:   ${updated}`);
    console.log(`Failed:    ${failed}`);
    console.log('============================================================');

    if (failed > 0) process.exitCode = 1;
}

run().catch(async (error) => {
    console.error('Critical Error:', error.message);
    try {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
