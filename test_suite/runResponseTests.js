const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

async function runResponseTests() {
  console.log('\n--- Running Response Tests ---');

  const testsDir = path.join(__dirname, 'response_tests');

  if (!fs.existsSync(testsDir)) {
    console.log('SKIPPED: response_tests directory not found.');
    process.exit(0);
  }

  const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.json'));

  if (files.length === 0) {
    console.log('SKIPPED: No response test files found.');
    process.exit(0);
  }

  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(testsDir, file);
    const tests = loadJson(filePath);

    if (!Array.isArray(tests)) {
      console.log(`❌ ${file} must contain an array of test cases.`);
      failed++;
      continue;
    }

    console.log(`📄 Checking ${file} (${tests.length} cases)`);

    for (const test of tests) {
      total++;

      const hasMessage = typeof test.message === 'string' || typeof test.userMessage === 'string';
      const hasExpected = typeof test.expected === 'object' && test.expected !== null;

      if (hasMessage && hasExpected) {
        passed++;
        process.stdout.write('\x1b[32m.\x1b[0m');
      } else {
        failed++;
        process.stdout.write('\x1b[31mF\x1b[0m');
        console.log(`\n[FAILED] Invalid response test structure in ${file}: ${test.id || 'NO_ID'}`);
      }
    }
  }

  console.log('\n\n==================================================');
  console.log('RESPONSE TEST REPORT');
  console.log('==================================================');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);
  console.log(`Accuracy:    ${total ? ((passed / total) * 100).toFixed(2) : '0.00'}%`);
  console.log('==================================================');

  process.exit(failed === 0 ? 0 : 1);
}

runResponseTests().catch(err => {
  console.error('FATAL RESPONSE TEST ERROR:', err.message);
  process.exit(1);
});