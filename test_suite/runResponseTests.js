/**
 * Response Quality Test Runner
 * Responsibility: Load response tests, execute AIService with mocks, and validate response quality.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const AIService = require('../src/features/ai/aiService');
const ConversationState = require('../src/features/ai/conversationState');
const Reporter = require('./conversationTestReporter'); // Reusing the detailed reporter
const {
    normalizeText,
    containsAny,
    containsAllMeaning,
    doesNotContainForbidden
} = require('./helpers/responseValidators');

// --- MOCK INFRASTRUCTURE ---
const mockModel = { findOne: async () => ({ value: 'mock_value' }), find: () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) }), countDocuments: async () => 0, create: async (data) => data };
mongoose.model = (name) => mockModel;
mongoose.connect = async () => {};
require('../src/features/ai/searchService').search = async () => [];

axios.post = async (url, data) => {
    const userQuery = data.messages.find(m => m.role === 'user')?.content || '';
    let content = `This is a mock response for: ${userQuery}`;
    if (userQuery.toLowerCase().includes('namaste')) {
        content = "Namaste! Main Jobo AI hoon. Main aapki kaise madad kar sakta hoon?";
    }
    return { data: { message: { content: content + " [SUGGESTIONS: Details, Apply, Fees]" } } };
};

AIService._fetchDatabaseKnowledge = async (query, profile, plan) => {
    // This can be expanded with mock data from the test case itself
    return { count: 0, jobs: "" };
};

async function runTests() {
    const testsDir = path.join(__dirname, 'response_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Response Quality Evaluation...\n`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        for (const test of tests) {
            const sessionId = `test_session_${test.id}_${Date.now()}`;
            ConversationState.sessionState.delete(sessionId);

            try {
                const result = await AIService.processRequest({
                    userMessage: test.message,
                    sessionId: sessionId,
                    userName: 'TestUser'
                });

                const passed = checkMatch(test, result);

                allResults.push({
                    id: test.id,
                    description: test.description || `Response check for "${test.message}"`,
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
    const normalizedMsg = normalizeText(actualMsg);

    if (expected.mustContainAny && !containsAny(actualMsg, expected.mustContainAny)) return false;
    if (expected.mustContainAll && !containsAllMeaning(actualMsg, expected.mustContainAll)) return false;
    if (expected.mustNotContain && !doesNotContainForbidden(actualMsg, expected.mustNotContain)) return false;

    if (expected.maxWords) {
        const wordCount = normalizedMsg.split(/\s+/).length;
        if (wordCount > expected.maxWords) return false;
    }

    return true;
}

runTests().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});