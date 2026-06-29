const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

const suites = [
  ['Intent Tests', 'test:intents'],
  ['Conversation Tests', 'test:conversation'],
  ['Response Tests', 'test:responses'],
  ['Safety Tests', 'test:safety'],
  ['Data Tests', 'test:data'],
  ['Performance Tests', 'test:performance'],
  ['Brain Tests', 'test:brain']
];

const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const allScripts = Object.keys(packageJson.scripts);

const availableSuites = suites.filter(([name, script]) => allScripts.includes(script));

function runSuite(name, script) {
  console.log(`\n--- Running ${name} ---\n`);

  const result = spawnSync('npm', ['run', script], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  });

  const passed = result.status === 0;

  console.log('\n----------------------------------');
  console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log('----------------------------------');

  return passed;
}

function main() {
  console.log('🚀🚀🚀 STARTING JOBO AI FULL TEST SUITE 🚀🚀🚀');
  console.log('==================================================\n');

  const results = [];

  for (const [name, script] of availableSuites) {
    results.push({ name, passed: runSuite(name, script) });
  }

  console.log('\n==================================================');
  console.log('📊 JOBO AI TEST SUITE SUMMARY');
  console.log('==================================================');

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
  }

  console.log('==================================================');

  const failed = results.filter(r => !r.passed);

  if (failed.length > 0) {
    console.log('\n🔥 SOME TESTS FAILED. PLEASE REVIEW LOGS.');
    process.exit(1);
  }

  console.log('\n🎉 ALL TEST SUITES PASSED.');
  process.exit(0);
}

main();