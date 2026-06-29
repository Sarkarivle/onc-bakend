const fs = require('fs');
const path = require('path');
const AIService = require('../aiService'); // Assuming test client is integrated or mocked here
const { assertNoForbiddenPhrases, assertGreetingIsShort } = require('./helpers/responseValidators');
const TestReporter = require('./helpers/testReporter');

const RESPONSE_TEST_DIR = path.join(__dirname, 'response_tests');

async function runResponseTests() {
    const reporter = new TestReporter('Response Quality');
    const testFiles = fs.readdirSync(RESPONSE_TEST_DIR).filter(f => f.endsWith('.test.json'));

    for (const file of testFiles) {
        const suiteName = path.basename(file, '.test.json');
        const testCases = JSON.parse(fs.readFileSync(path.join(RESPONSE_TEST_DIR, file), 'utf-8'));

        for (const test of testCases) {
            try {
                // In a real scenario, AIService would be mocked to use mock DB/State
                const response = await AIService.processRequest({
                    userMessage: test.input,
                    sessionId: `test_${Date.now()}`
                    // Mocked state and profile would go here
                });

                // Generic Validations for all responses
                assertNoForbiddenPhrases(response.message);

                // Specific Validations based on test case expectations
                if (test.expected.includes('short_greeting')) {
                    assertGreetingIsShort(response.message);
                }

                if (test.expected.includes('has_job_structure')) {
                    if (!response.message.includes('Last Date:') && !response.message.includes('Vacancy:')) {
                        throw new Error('Response is missing expected job structure (Last Date/Vacancy).');
                    }
                }

                if (test.expected.includes('no_job_listing')) {
                     if (response.message.toLowerCase().includes('vacancy:')) {
                        throw new Error('Response incorrectly contains a job listing.');
                    }
                }

                reporter.addSuccess(suiteName, test.name);
            } catch (error) {
                reporter.addFailure(suiteName, test.name, error.message);
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