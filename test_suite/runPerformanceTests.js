#!/usr/bin/env node
/**
 * Performance & Resilience Test Runner
 * Responsibility: Load performance tests, execute AIService with mocks, and validate latency and stability.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const AIService = require('../src/features/ai/aiService');
const Reporter = require('./conversationTestReporter');

// --- MOCK INFRASTRUCTURE ---
const mockModel = { findOne: async () => null, find: () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) }), countDocuments: async () => 0, create: async (data) => data };
mongoose.model = (name) => mockModel;
mongoose.connect = async () => {};
require('../src/features/ai/searchService').search = async () => [];

axios.post = async (url, data) => {
    // Simulate a realistic but fast LLM response time
    await new Promise(res => setTimeout(res, 50 + Math.random() * 50));
    return { data: { message: { content: "This is a fast mock response." } } };
};

AIService._fetchDatabaseKnowledge = async () => {
    await new Promise(res => setTimeout(res, 20 + Math.random() * 30));
    return { count: 0, jobs: "" };
};

async function runTests() {
    const testsDir = path.join(__dirname, 'performance_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Performance & Resilience Evaluation...\n`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        for (const test of tests) {
            let passed = false;
            let actual = {};
            const startTime = Date.now();

            try {
                const result = await AIService.processRequest({ userMessage: test.message, sessionId: `perf_${test.id}` });
                const latency = Date.now() - startTime;

                actual = { latency: `${latency}ms`, noCrash: true };

                if (test.expected.noCrash && result.success) {
                    if (test.maxMs) {
                        passed = latency <= test.maxMs;
                        if (!passed) actual.error = `Latency ${latency}ms exceeded limit of ${test.maxMs}ms.`;
                    } else {
                        passed = true;
                    }
                }
            } catch (err) {
                actual = { latency: `${Date.now() - startTime}ms`, noCrash: false, error: err.message };
                passed = false;
            }

            allResults.push({
                id: test.id,
                description: test.description || `Performance check for "${test.message}"`,
                message: test.message,
                expected: test.expected,
                actual,
                passed
            });
            process.stdout.write(passed ? '\x1b[32m.\x1b[0m' : '\x1b[31mF\x1b[0m');
        }
    }

    Reporter.report(allResults);
    const failedCount = allResults.filter(r => !r.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});