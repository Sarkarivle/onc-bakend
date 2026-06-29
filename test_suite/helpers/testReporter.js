class TestReporter {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.total = 0;
        this.passed = 0;
        this.failed = 0;
        this.failedCases = [];
    }

    addSuccess(caseName, testId) {
        this.total++;
        this.passed++;
    }

    addFailure(caseName, testId, reason, actual = {}) {
        this.total++;
        this.failed++;
        this.failedCases.push({ id: testId, name: caseName, reason, actual });
    }

    print() {
        console.log(`\n==================================================`);
        console.log(`📊 ${this.suiteName.toUpperCase()} TEST REPORT`);
        console.log(`==================================================`);
        console.log(`Total Tests: ${this.total}`);
        console.log(`✅ Passed:    ${this.passed}`);
        console.log(`❌ Failed:      ${this.failed}`);
        console.log(`🎯 Accuracy:    ${this.total > 0 ? ((this.passed / this.total) * 100).toFixed(2) : '0.00'}%`);
        console.log(`==================================================`);

        if (this.failed > 0) {
            console.log('\nFAILED CASES:\n');
            this.failedCases.forEach(fail => {
                console.log(`[FAILED] ID: ${fail.id} (${fail.name})`);
                console.log(`  Reason: ${fail.reason}`);
                if (fail.actual.message) console.log(`  Actual Response: "${fail.actual.message.substring(0, 100)}..."`);
                console.log('------------------------------');
            });
        }
    }

    getSummary() {
        return { total: this.total, passed: this.passed, failed: this.failed };
    }
}

module.exports = TestReporter;