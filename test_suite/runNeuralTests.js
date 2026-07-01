const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Load Orchestrator components
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const DeterministicIntentResolver = require('../src/features/ai/intent/DeterministicIntentResolver');
const AgenticPlanner = require('../src/features/ai/reasoning/agenticPlanner');
const UserProfile = require('../src/features/ai/context/userProfile');

const TEST_FILE = path.join(__dirname, 'neural_tests.json');
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

async function runTest(testCase) {
    const { query, context = {}, profile = {} } = testCase;

    console.log(`\nTesting Query: "${query}"`);

    try {
        // 1. Run Intent Detection
        // SIMULATE: First try deterministic resolution, then fall back to semantic.
        let resolvedIntent = DeterministicIntentResolver.resolve(query);
        if (!resolvedIntent) {
            resolvedIntent = await IntentEngine.classify(query, context, profile);
        }


        // 2. Run Agentic Planning
        const plan = await AgenticPlanner.generatePlan(query, resolvedIntent.normalizedIntent, {
            topic: context.currentTopic || 'GENERAL',
            profileStr: UserProfile.toContextString(profile)
        });

        const actual = {
            intent: resolvedIntent.normalizedIntent,
            mode: plan.mode,
            behavior: plan.behavior,
            tone: plan.emotionalTone || resolvedIntent.tone
        };

        const result = {
            id: testCase.id,
            query,
            expected: testCase.expected,
            actual,
            passed: true,
            mismatches: []
        };

        // Validate
        for (const [key, expectedValue] of Object.entries(testCase.expected)) {
            if (actual[key] !== expectedValue) {
                result.passed = false;
                result.mismatches.push(`${key}: Expected "${expectedValue}", got "${actual[key]}"`);
            }
        }

        return result;

    } catch (error) {
        return {
            id: testCase.id,
            query,
            error: error.message,
            passed: false
        };
    }
}

async function main() {
    console.log('🧠 Starting Neural Logic Evaluation (Multi-Label)...');

    try {
        await mongoose.connect(mongoURI);
        console.log('✅ DB Connected for Tests');
    } catch (err) {
        console.error('❌ DB Connection Error:', err.message);
        process.exit(1);
    }

    if (!fs.existsSync(TEST_FILE)) {
        console.error('Test file not found!');
        mongoose.disconnect();
        return;
    }

    const tests = JSON.parse(fs.readFileSync(TEST_FILE, 'utf8'));
    const results = [];

    for (const test of tests) {
        const res = await runTest(test);
        results.push(res);

        if (res.passed) {
            console.log(`  ✅ [PASSED] ${test.id}`);
        } else {
            console.log(`  ❌ [FAILED] ${test.id}`);
            if (res.error) {
                console.log(`     Error: ${res.error}`);
            } else {
                res.mismatches.forEach(m => console.log(`     - ${m}`));
            }
        }
    }

    const passedCount = results.filter(r => r.passed).length;
    console.log('\n============================================================');
    console.log('NEURAL INTELLIGENCE REPORT');
    console.log('============================================================');
    console.log(`Total Cases: ${tests.length}`);
    console.log(`Passed:      ${passedCount}`);
    console.log(`Failed:      ${tests.length - passedCount}`);
    console.log(`Accuracy:    ${((passedCount / tests.length) * 100).toFixed(2)}%`);
    console.log('============================================================\n');

    await mongoose.disconnect();
}

main();
