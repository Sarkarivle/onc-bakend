/**
 * ConversationTestReporter
 * Responsibility: Format and print conversation test results.
 */
class ConversationTestReporter {
    static report(results) {
        const total = results.length;
        const passed = results.filter(r => r.passed).length;
        const failed = total - passed;
        const accuracy = ((passed / total) * 100).toFixed(2);

        console.log("\n" + "=".repeat(60));
        console.log("CONVERSATION BEHAVIOR EVALUATION REPORT");
        console.log("=".repeat(60));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed:      \x1b[32m${passed}\x1b[0m`);
        console.log(`Failed:      \x1b[31m${failed}\x1b[0m`);
        console.log(`Accuracy:    ${accuracy}%`);
        console.log("=".repeat(60) + "\n");

        if (failed > 0) {
            console.log("FAILED CASES:");
            results.filter(r => !r.passed).forEach(r => {
                console.log(`\x1b[31m[FAILED]\x1b[0m ${r.id}: ${r.description}`);
                console.log(`  User Msg: "${r.message}"`);
                console.log(`  Expected: ${JSON.stringify(r.expected, null, 2)}`);
                console.log(`  Actual:   ${JSON.stringify(r.actual, null, 2)}`);
                console.log("-".repeat(40));
            });
        }

        return passed === total;
    }
}

module.exports = ConversationTestReporter;
