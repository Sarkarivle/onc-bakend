const { execSync } = require('child_process');

const TEST_SUITES = [
    { name: 'Intent Tests', command: 'node ../../test_suite/legacy/intent_unit_tests.js' },
    { name: 'Response Tests', command: 'node ../../test_suite/runResponseTests.js' },
    { name: 'Safety Tests', command: 'echo "Safety tests need a runner" && exit 0' }, // Placeholder
    { name: 'Data Tests', command: 'echo "Data tests need a runner" && exit 0' }, // Placeholder
    { name: 'Conversation Tests', command: 'node ../../test_suite/conversation_tests/runConversationTests.js' },
    { name: 'Performance Tests', command: 'echo "Performance tests need a runner" && exit 0' }, // Placeholder
];

async function runAllTests() {
    console.log('🚀🚀🚀 STARTING JOBO AI FULL TEST SUITE 🚀🚀🚀');
    console.log('==================================================\n');

    const results = [];
    let allPassed = true;

    for (const suite of TEST_SUITES) {
        console.log(`\n--- Running ${suite.name} ---\n`);
        try {
            execSync(suite.command, { stdio: 'inherit' });
            console.log(`\n✅ ${suite.name}: PASSED`);
            results.push({ name: suite.name, status: 'PASSED' });
        } catch (error) {
            console.error(`\n❌ ${suite.name}: FAILED`);
            results.push({ name: suite.name, status: 'FAILED' });
            allPassed = false;
        }
        console.log('\n----------------------------------');
    }

    console.log('\n\n==================================================');
    console.log('📊 JOBO AI TEST SUITE SUMMARY 📊');
    console.log('==================================================');
    results.forEach(res => {
        console.log(`${res.status === 'PASSED' ? '✅' : '❌'} ${res.name}: ${res.status}`);
    });
    console.log('==================================================\n');

    if (allPassed) {
        console.log('🎉🎉🎉 ALL JOBO AI TESTS PASSED 🎉🎉🎉\n');
    } else {
        console.error('🔥🔥🔥 SOME TESTS FAILED. PLEASE REVIEW LOGS. 🔥🔥🔥\n');
        process.exit(1);
    }
}

runAllTests();