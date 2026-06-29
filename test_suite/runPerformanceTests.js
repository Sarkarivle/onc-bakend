#!/usr/bin/env node
/**
 * Performance & Resilience Test Runner
 * Responsibility: Load performance tests, execute AIService with mocks, and validate latency and stability.
 */
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./helpers/mockAiClient');
const Reporter = require('./conversationTestReporter');

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
        let tests;
        try {
            tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`\n❌ FATAL: Invalid JSON in ${file}: ${e.message}`);
            process.exit(1);
        }

        for (const test of tests) {
            if (test.type === 'bulk') {
                // Handle bulk tests
                let passed = false;
                let actual = {};
                const initialListeners = process.listenerCount('unhandledRejection');
                const startTime = Date.now();

                try {
                    const promises = [];
                    for (let i = 0; i < test.count; i++) {
                        const query = test.queries[i % test.queries.length];
                        promises.push(processMessage(query));
                    }
                    await Promise.all(promises);
                    const latency = Date.now() - startTime;
                    const finalListeners = process.listenerCount('unhandledRejection');

                    actual = { latency: `${latency}ms`, noCrash: true, listenerChange: finalListeners - initialListeners };
                    passed = latency <= test.maxMs;
                    if (!passed) actual.error = `Bulk latency ${latency}ms exceeded limit of ${test.maxMs}ms.`;

                    if (test.expected.noMemoryLeak) {
                        if (finalListeners > initialListeners) {
                            passed = false;
                            actual.error = (actual.error || "") + ` Potential listener leak detected (+${finalListeners - initialListeners}).`;
                        }
                    }

                } catch (err) {
                    actual = { latency: `${Date.now() - startTime}ms`, noCrash: false, error: err.message };
                    passed = false;
                }

                allResults.push({ id: test.id, description: test.description, passed, actual, expected: test.expected });
                process.stdout.write(passed ? '\x1b[32m.\x1b[0m' : '\x1b[31mF\x1b[0m');

            } else {
                // Handle single tests
                let passed = false;
                let actual = {};
                const startTime = Date.now();

                try {
                    await processMessage(test.message);
                    const latency = Date.now() - startTime;

                    actual = { latency: `${latency}ms`, noCrash: true };
                    if (test.expected.noCrash) {
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
    }

    Reporter.report(allResults);
    const failedCount = allResults.filter(r => !r.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});