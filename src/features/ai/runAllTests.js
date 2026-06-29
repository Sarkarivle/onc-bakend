const { execSync } = require('child_process');

const TEST_SUITES = [
    { name: 'Intent Tests', command: 'npm run test:intents' },
    { name: 'Response Tests', command: 'npm run test:responses' },
    { name: 'Safety Tests', command: 'npm run test:safety' },
    { name: 'Data Tests', command: 'npm run test:data' },
    { name: 'Conversation Tests', command: 'npm run test:conversation' },
    { name: 'Performance Tests', command: 'npm run test:performance' },
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