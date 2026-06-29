#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const TestAiClient = require('./testAiClient');
const validators = require('./responseValidators');
const TestReporter = require('./testReporter');

const RESPONSE_TEST_DIR = path.join(__dirname, '../../test_suite/response_tests');

// Per-file minimum test counts for this suite
const MINIMUM_TESTS_PER_FILE = {
    'greeting_response.test.json': 50,
    'job_response.test.json': 100,
    'career_response.test.json': 75,
    'followup_response.test.json': 100,
    'resume_response.test.json': 50,
    'scholarship_response.test.json': 50,
    'result_admitcard_response.test.json': 75,
    'general_response.test.json': 50
};

/**
 * Checks if a response contains a phrase or its synonyms.
 * @param {string} responseText The AI's response message.
 * @param {string} expectedPhrase The phrase to check from the test case.
 * @returns {boolean}
 */
function responseContains(responseText, expectedPhrase) {
    const text = responseText.toLowerCase();
    const synonymGroups = {
        "eligibility test": ["eligibility test", "eligibility exam", "yogyata pariksha", "पात्रता परीक्षा", "eligibility"],
        "not a direct vacancy": ["not a direct vacancy", "direct vacancy nahi", "direct recruitment nahi", "direct bharti nahi", "vacancy nahi hai", "सीधी भर्ती नहीं", "direct vacancy नहीं"]
    };

    const phraseKey = expectedPhrase.toLowerCase();

    if (synonymGroups[phraseKey]) {
        // If we have synonyms defined, check if any of them exist in the response
        return synonymGroups[phraseKey].some(synonym => text.includes(synonym.toLowerCase()));
    } else {
        // Default behavior: simple substring check
        return text.includes(phraseKey);
    }
}

async function runResponseTests() {
    const reporter = new TestReporter('Response Quality');
    const testFiles = fs.readdirSync(RESPONSE_TEST_DIR).filter(f => f.endsWith('.test.json'));

    for (const file of testFiles) {
        const suiteName = path.basename(file, '.test.json');
        const filePath = path.join(RESPONSE_TEST_DIR, file);
        const testCases = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const requiredCount = MINIMUM_TESTS_PER_FILE[file] || 0;

        if (testCases.length < requiredCount) {
            reporter.addFailure(suiteName, `MIN_COUNT_${file}`, `Not enough tests in ${file}. Found ${testCases.length}, required ${requiredCount}.`);
            continue; // Skip running tests for this file but mark it as failed
        }

        for (const test of testCases) {
            try {
                const response = await TestAiClient.process(test.message, {
                    context: test.context,
                    profile: test.userProfile,
                    mockData: test.mockData
                });

                // Run all specified validators
                for (const validatorName of test.expected.validators || []) {
                    if (validators[validatorName]) {
                        validators[validatorName](response, test.mockData, test.userProfile);
                    } else {
                        throw new Error(`Unknown validator specified: ${validatorName}`);
                    }
                }

                // Check for specific content
                (test.expected.mustContain || []).forEach(phrase => {
                    if (!responseContains(response.message, phrase)) throw new Error(`Response must contain meaning of "${phrase}"`);
                });
                (test.expected.mustNotContain || []).forEach(phrase => {
                    if (response.message.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Response must not contain "${phrase}"`);
                });

                reporter.addSuccess(suiteName, test.id);
            } catch (error) {
                reporter.addFailure(suiteName, test.id, error.message, error.actual || {});
            }
        }
    }

    reporter.print();
    return reporter.getSummary();
}

if (require.main === module) {
    runResponseTests().then(summary => {
        if (summary.failed > 0) {
            process.exit(1);
        }
    });
}

module.exports = runResponseTests;