/**
 * Conversation Behavior Test Runner
 * Responsibility: Load conversation tests, execute against a mock client, and report results.
 */
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./helpers/mockAiClient');
const Reporter = require('./conversationTestReporter');

async function runTests() {
    const testsDir = path.join(__dirname, 'conversation_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Conversation Behavior Evaluation...\n`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        for (const test of tests) {
            try {
                // Use mockAiClient for a simpler, faster, and more deterministic test run
                const result = await processMessage(test.userMessage, test.state || {});
                const passed = checkMatch(test, result);

                allResults.push({
                    id: test.id,
                    description: test.description,
                    message: test.userMessage,
                    expected: test.expected,
                    // The mock client directly returns the message and intent
                    actual: {
                        intent: result.intent,
                        domain: result.domain,
                        behavior: result.behavior,
                        message: result.message,
                    },
                    passed
                });

                process.stdout.write(passed ? '\x1b[32m.\x1b[0m' : '\x1b[31mF\x1b[0m');
            } catch (err) {
                console.error(`\n❌ Error in test ${test.id}:`, err);
                allResults.push({
                    id: test.id,
                    description: test.description,
                    message: test.userMessage,
                    expected: test.expected,
                    actual: { error: err.message },
                    passed: false
                });
                process.stdout.write('\x1b[31mE\x1b[0m');
            }
        }
    }

    Reporter.report(allResults);
    const failedCount = allResults.filter(r => !r.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);
}

function matchesResponseMeaning(actualMsg, expectedPhrase) {
    const msg = String(actualMsg || "").toLowerCase();
    const phrase = String(expectedPhrase || "").toLowerCase();

    const synonymGroups = {
        "eligibility test": [
            "eligibility test",
            "eligibility exam",
            "eligibility",
            "yogyata pariksha",
            "पात्रता परीक्षा"
        ],
        "not a direct vacancy": [
            "not a direct vacancy",
            "direct vacancy nahi",
            "direct vacancy नहीं",
            "direct recruitment nahi",
            "direct bharti nahi",
            "direct bharti nahi hai",
            "vacancy nahi hai",
            "सीधी भर्ती नहीं"
        ],
        "no verified data": [
            "verified jankari nahi mili",
            "verified information nahi hai",
            "abhi pakki jankari nahi hai",
            "official notification verify nahi hua",
            "maaf kijiye",
            "i'm sorry"
        ]
    };

    const synonyms = synonymGroups[phrase] || [phrase];
    return synonyms.some(s => msg.includes(String(s).toLowerCase()));
}

function checkMatch(test, result) {
    const expected = test.expected;
    const actualMsg = (result.message || "").toLowerCase();

    // Check intent, domain, and behavior if specified in the test
    if (expected.intent && result.intent !== expected.intent) return false;
    if (expected.domain && result.domain !== expected.domain) return false;
    if (expected.behavior && result.behavior !== expected.behavior) return false;

    if (expected.responseContains) {
        for (const phrase of expected.responseContains) {
            if (!actualMsg.includes(phrase.toLowerCase())) return false;
        }
    }

    if (expected.responseMustNotContain) {
        for (const word of expected.responseMustNotContain) {
            if (actualMsg.includes(word.toLowerCase())) return false;
        }
    }

    return true;
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
