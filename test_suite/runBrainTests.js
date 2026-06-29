const fs = require('fs');
const path = require('path');
const brain = require('../src/features/ai/brain');

const TEST_DIR = path.join(__dirname, 'brain_tests');

function getMessage(test) {
  const v = test.userMessage ?? test.message ?? test.query ?? test.input ?? '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function getExpected(test) {
  return test.expected || test.expect || {};
}

function pickModule(fileName) {
  if (fileName.includes('semantic_query_interpreter')) return brain.semanticQueryInterpreter;
  if (fileName.includes('semantic_retrieval_planner')) return brain.semanticRetrievalPlanner;
  if (fileName.includes('query_normalizer')) return brain.queryNormalizer;
  if (fileName.includes('intent_domain_analyzer')) return brain.intentDomainAnalyzer;
  if (fileName.includes('entity_extractor')) return brain.entityExtractor;
  if (fileName.includes('context_resolver')) return brain.contextResolver;
  if (fileName.includes('retrieval_planner')) return brain.retrievalPlanner;
  if (fileName.includes('guardrail_validator')) return brain.guardrailValidator;
  if (fileName.includes('confidence_scorer')) return brain.confidenceScorer;
  if (fileName.includes('response_planner')) return brain.responsePlanner;
  return null;
}

async function runModule(mod, message, test) {
  if (!mod) return {};

  const history = test.history || [];
  const context = test.context || {};

  function isClass(fn) {
    return typeof fn === 'function' && /^class\s/.test(Function.prototype.toString.call(fn));
  }

  function callKnownMethods(target) {
    if (!target) return null;

    for (const fn of [
      'normalize',
      'analyze',
      'detect',
      'extract',
      'extractEntities',
      'resolve',
      'plan',
      'validate',
      'score',
      'interpret',
      'createPlan'
    ]) {
      if (typeof target[fn] === 'function') {
        return target[fn](message, history, context);
      }
    }

    return null;
  }

  try {
    if (isClass(mod)) {
      const instance = new mod();
      const instanceResult = callKnownMethods(instance);
      if (instanceResult !== null) return instanceResult;

      const staticResult = callKnownMethods(mod);
      if (staticResult !== null) return staticResult;
    }

    if (typeof mod === 'function') {
      return mod(message, history, context);
    }

    const directResult = callKnownMethods(mod);
    if (directResult !== null) return directResult;

    if (mod.default) {
      const d = mod.default;

      if (isClass(d)) {
        const instance = new d();
        const instanceResult = callKnownMethods(instance);
        if (instanceResult !== null) return instanceResult;

        const staticResult = callKnownMethods(d);
        if (staticResult !== null) return staticResult;
      }

      if (typeof d === 'function') return d(message, history, context);

      const defaultResult = callKnownMethods(d);
      if (defaultResult !== null) return defaultResult;
    }

    return {};
  } catch (e) {
    return { error: e.message };
  }
}

function norm(v) {
  return typeof v === 'string' ? v.toLowerCase().trim() : v;
}

function valueMatches(actualValue, expectedValue) {
  if (
    expectedValue &&
    typeof expectedValue === 'object' &&
    !Array.isArray(expectedValue) &&
    expectedValue.minScore !== undefined
  ) {
    const score = actualValue?.score ?? actualValue?.overallConfidence ?? actualValue?.confidence ?? actualValue;
    return Number(score) >= Number(expectedValue.minScore);
  }

  if (
    expectedValue &&
    typeof expectedValue === 'object' &&
    !Array.isArray(expectedValue) &&
    expectedValue.maxScore !== undefined
  ) {
    const score = actualValue?.score ?? actualValue?.overallConfidence ?? actualValue?.confidence ?? actualValue;
    return Number(score) <= Number(expectedValue.maxScore);
  }

  if (Array.isArray(expectedValue)) {
    const actualArray = Array.isArray(actualValue) ? actualValue : [actualValue];
    return expectedValue.every(e => actualArray.map(norm).includes(norm(e)));
  }

  if (expectedValue && typeof expectedValue === 'object') {
    if (!actualValue || typeof actualValue !== 'object') return false;
    return Object.keys(expectedValue).every(k => valueMatches(actualValue[k], expectedValue[k]));
  }

  return norm(actualValue) === norm(expectedValue);
}

function matches(actual, expected) {
  if (expected.minScore !== undefined) {
    const s = actual.score ?? actual.overallConfidence ?? actual.confidence ?? 0;
    if (s < expected.minScore) return false;
  }

  if (expected.maxScore !== undefined) {
    const s = actual.score ?? actual.overallConfidence ?? actual.confidence ?? 100;
    if (s > expected.maxScore) return false;
  }

  return Object.keys(expected)
    .filter(k => !['minScore', 'maxScore'].includes(k))
    .every(k => valueMatches(actual[k], expected[k]));
}

function loadTests(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.tests)) return raw.tests;
  if (Array.isArray(raw.cases)) return raw.cases;
  return [];
}

async function main() {
  console.log('\n🚀 Starting Brain Foundation Evaluation...\n');

  const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.json')).sort();
  let total = 0;
  let passed = 0;
  const failed = [];

  for (const file of files) {
    const mod = pickModule(file);
    const tests = loadTests(path.join(TEST_DIR, file));

    for (const test of tests) {
      total++;
      const message = getMessage(test);
      const expected = getExpected(test);
      let actual = {};

      try {
        actual = await runModule(mod, message, test);
      } catch (e) {
        actual = { error: e.message };
      }

      if (matches(actual, expected)) {
        passed++;
        process.stdout.write('.');
      } else {
        process.stdout.write('F');
        failed.push({
          id: test.id || test.name || `case_${total}`,
          title: test.title || test.description || '',
          message,
          expected,
          actual
        });
      }
    }
  }

  console.log('\n============================================================');
  console.log('CONVERSATION BEHAVIOR EVALUATION REPORT');
  console.log('============================================================');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed.length}`);
  console.log(`Accuracy:    ${total ? ((passed / total) * 100).toFixed(2) : '0.00'}%`);
  console.log('============================================================');

  if (failed.length) {
    console.log('\nFAILED CASES:');
    for (const f of failed) {
      console.log(`[FAILED] ${f.id}: ${f.title}`);
      console.log(`  User Msg: "${f.message}"`);
      console.log('  Expected:', JSON.stringify(f.expected, null, 2));
      console.log('  Actual:  ', JSON.stringify(f.actual, null, 2));
      console.log('----------------------------------------');
    }
    process.exit(1);
  }
}

main();
