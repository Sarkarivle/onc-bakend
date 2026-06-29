#!/usr/bin/env node
/**
 * Data & Routing Test Runner
 * Responsibility: Load data tests, execute AIService with mocked data sources, and validate data handling.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const AIService = require('../src/features/ai/aiService');
const ConversationState = require('../src/features/ai/conversationState');
const Reporter = require('./conversationTestReporter');
const { isSafeNoDataResponse, isEligibilityTestResponse, doesNotContainForbidden, containsAny } = require('./helpers/responseValidators');

// --- MOCK INFRASTRUCTURE ---
const mockModel = { findOne: async () => null, find: () => ({ sort: () => ({ lean: () => Promise.resolve([]) }) }), countDocuments: async () => 0, create: async (data) => data };
mongoose.model = (name) => mockModel;
mongoose.connect = async () => {};
require('../src/features/ai/searchService').search = async () => [];

async function runTests() {
    const testsDir = path.join(__dirname, 'data_tests');
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Tests directory not found: ${testsDir}`);
        process.exit(1);
    }
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

    let allResults = [];
    console.log(`\n🚀 Starting Data Routing & Logic Evaluation...\n`);

    for (const file of testFiles) {
        const filePath = path.join(testsDir, file);
        const tests = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        for (const test of tests) {
            const sessionId = `test_session_${test.id}_${Date.now()}`;
            ConversationState.sessionState.set(sessionId, test.context || {});

            // Override the DB fetcher for this specific test
            AIService._fetchDatabaseKnowledge = async (query) => {
                const mock = test.mockData || {};
                const jobs = (mock.activeJobs || []).map(j => `- JOB: ${j.title} | Last Date: ${j.lastDate}`).join('\n');
                return { count: mock.activeJobs?.length || 0, jobs };
            };

            // --- DYNAMIC MOCKING ---
            // Allow each test case to define its own mock LLM response
            axios.post = async (url, data) => {
                return { data: { message: { content: test.mockLLMResponse || "This is a mock data response." } } };
            };

            try {
                const result = await AIService.processRequest({ userMessage: test.message, sessionId });
                const passed = checkMatch(test, result);

                allResults.push({
                    id: test.id,
                    description: test.description || `Data logic check for "${test.message}"`,
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

    if (expected.mustContain && !containsAny(actualMsg, expected.mustContain)) return false;
    if (expected.mustNotContain && !doesNotContainForbidden(actualMsg, expected.mustNotContain)) return false;
    if (expected.safeNoData && !isSafeNoDataResponse(actualMsg)) return false;
    if (expected.isEligibilityTestResponse && !isEligibilityTestResponse(actualMsg)) return false;
    return true;
}

runTests().catch(err => { console.error("FATAL ERROR:", err); process.exit(1); });