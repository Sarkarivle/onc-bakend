/**
 * Intent Test Runner
 * Responsibility: Load tests, execute Intent Engine, and report results.
 */
const fs = require('fs');
const path = require('path');

// 1. Mock Infrastructure before requiring the classifier
const mongoose = require('mongoose');

// Mock Mongoose Model
const mockModel = {
    findOne: async () => null,
    find: async () => [],
    countDocuments: async () => 0,
    create: async () => ({})
};

// Override mongoose.model to prevent DB errors
mongoose.model = (name) => mockModel;

// Mock axios to prevent network calls during tests
const axios = require('axios');
axios.post = async () => ({
    data: { response: '{"primaryIntent": "GENERAL_QUERY", "confidence": 0.5}' }
});

// 2. Load the Intent Engine
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const Reporter = require('./intentTestReporter');

async function runTests() {
    const testsDir = path.join(__dirname, 'intent_tests');
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];

    console.log(`🚀 Starting Intent Evaluation for ${testFiles.length} files...`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        console.log(`📄 Testing ${file} (${tests.length} cases)`);

        for (const test of tests) {
            try {
                // Call the actual intent engine
                const actual = await IntentEngine.classify(
                    test.message,
                    test.context || {},
                    test.userProfile || {}
                );

                const passed = checkMatch(test.expected, actual);

                allResults.push({
                    id: test.id,
                    message: test.message,
                    expected: test.expected,
                    actual: {
                        communicationAct: actual.communicationAct,
                        domain: actual.domain,
                        task: actual.task,
                        resolvedIntent: actual.resolvedIntent,
                        isFollowUp: actual.isFollowUp,
                        isPureGreeting: actual.isPureGreeting
                    },
                    passed
                });
            } catch (err) {
                console.error(`❌ Error in test ${test.id}:`, err.message);
                allResults.push({
                    id: test.id,
                    message: test.message,
                    expected: test.expected,
                    actual: { error: err.message },
                    passed: false
                });
            }
        }
    }

    const success = Reporter.report(allResults);
    process.exit(success ? 0 : 1);
}

function checkMatch(expected, actual) {
    for (const key in expected) {
        if (actual[key] !== expected[key]) {
            return false;
        }
    }
    return true;
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
