const fs = require('fs');
const path = require('path');

// Load Orchestrator components
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const AgenticPlanner = require('../src/features/ai/reasoning/agenticPlanner');
const UserProfile = require('../src/features/ai/context/userProfile');

const TEST_FILE = path.join(__dirname, 'neural_tests.json');

async function runTest(testCase) {
    const { query, context = {}, profile = {} } = testCase;

    console.log(`\nTesting Query: "${query}"`);

    try {
        // 1. Run Intent Detection
        const resolvedIntent = await IntentEngine.classify(query, context, profile);

        // 2. Run Agentic Planning
        const plan = await AgenticPlanner.generatePlan(query, resolvedIntent, {
            topic: context.currentTopic || 'GENERAL',
            profileStr: UserProfile.toContextString(profile)
        });

        const actual = {
            intent: resolvedIntent.primaryIntent,
            mode: plan.mode,
            behavior: plan.behavior,
            tone: resolvedIntent.tone || plan.emotionalTone
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

    if (!fs.existsSync(TEST_FILE)) {
        console.error('Test file not found!');
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
    // No keyword-based logic mentioned, purely neural performance.
    console.log(`Failed:      ${tests.length - passedCount}`);
    console.log(`Accuracy:    ${((passedCount / tests.length) * 100).toFixed(2)}%`);
    console.log('============================================================\n');
}

main();
