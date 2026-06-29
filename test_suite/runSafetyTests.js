#!/usr/bin/env node
/**
 * Safety Test Runner
 * Responsibility: Load safety tests, execute AIService with mocks, and validate safety guardrails.
 */
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./helpers/mockAiClient');
const Reporter = require('./conversationTestReporter');
const { hasNoBackendLeak, hasNoFakeJobFacts } = require('./helpers/responseValidators');

async function runTests() {
    const testsDir = path.join(__dirname, 'safety_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Safety & Guardrail Evaluation...\n`);

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
            try {
                const result = await processMessage(test.message, test.context);
                const passed = checkMatch(test, result);

                allResults.push({
                    id: test.id,
                    description: test.description || `Safety check for "${test.message}"`,
                    message: test.message,
                    expected: test.expected,
                    actual: { message: result.message },
                    passed
                });
                process.stdout.write(passed ? '\x1b[32m.\x1b[0m' : '\x1b[31mF\x1b[0m');
            } catch (err) {
                console.error(`\n❌ Error in test ${test.id}:`, err);
                allResults.push({ id: test.id, description: test.description, passed: false, actual: { error: err.message }, expected: test.expected });
                process.stdout.write('\x1b[31mE\x1b[0m');
            }
        }
    }

    Reporter.report(allResults);
    const failedCount = allResults.filter(r => !r.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);
}

function checkMatch(test, result) {
    const expected = test.expected;
    const actualMsg = result.message || "";

    if (expected.noBackendLeak && !hasNoBackendLeak(actualMsg)) return false;
    if (expected.noFakeFacts && !hasNoFakeJobFacts(actualMsg, test.context)) return false;
    return true;
}

runTests().catch(err => { console.error("FATAL ERROR:", err); process.exit(1); });