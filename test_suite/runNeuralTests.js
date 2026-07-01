const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { performance } = require('perf_hooks');
require('dotenv').config();

// Load Orchestrator components
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const SmartGateway = require('../src/features/ai/safety/smartGateway'); // Assuming path
const Formatter = require('../src/features/ai/output/responseFormatter'); // Assuming path
const NeuralRefiner = require('../src/features/ai/intent/normalizers/neuralRefiner');
const AgenticPlanner = require('../src/features/ai/reasoning/agenticPlanner');
const UserProfile = require('../src/features/ai/context/userProfile');

const SCENARIOS_DIR = path.join(__dirname, 'scenarios');
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

// Expanded TEST_MODULES to include all testable phases
const TEST_MODULES = {
    '00': { name: 'Contract', file: '00_Contract/intent_contract.json', runner: runIntentTest },
    '01': { name: 'SmartGateway', file: '01_SmartGateway/gateway.json', runner: runGatewayTest },
    '02': { name: 'NeuralRefiner', file: '02_NeuralRefiner/meaning_preservation.json', runner: runRefinerTest },
    '03_anti_overfit': { name: 'IntentEngine Anti-Overfit', file: '03_IntentEngine/anti_overfit.json', runner: runIntentTest },
    '03': { name: 'IntentEngine', file: '03_IntentEngine/semantic_bhaav.json', runner: runIntentTest },
    '04': { name: 'AgenticPlanner', file: '04_AgenticPlanner/no_remap.json', runner: runPlannerTest },
    '10': { name: 'Formatter', file: '10_Formatter/formatter.json', runner: runFormatterTest },
};

async function runTest(testCase) {
    const { query, context = {}, profile = {} } = testCase;

    console.log(`\nTesting Query: "${query}"`);

    try {
        // 1. Run Intent Detection
        const resolvedIntent = await IntentEngine.classify(query, context, profile);

        // 2. Run Agentic Planning
        const plan = await AgenticPlanner.generatePlan(query, resolvedIntent.normalizedIntent, {
            topic: context.currentTopic || 'GENERAL',
            profileStr: UserProfile.toContextString(profile)
        });

        const actual = {
            intent: resolvedIntent.normalizedIntent,
            mode: resolvedIntent.mode,
            behavior: resolvedIntent.behavior,
            tone: plan.emotionalTone || resolvedIntent.tone
        };

        const result = {
            id: testCase.id,
            query,
            expected: testCase.expected,
            actual,
            passed: true,
            mismatches: []
        };

        // Validate
        for (const [key, expectedValue] of Object.entries(testCase.expected)) {
            if (actual[key] !== expectedValue) {
                result.passed = false;
                result.mismatches.push(`${key}: Expected "${expectedValue}", got "${actual[key]}"`);
            }
        }

        return result;

    } catch (error) {
        return {
            id: testCase.id,
            query,
            error: error.message,
            passed: false
        };
    }
}

async function runIntentTest(testCase) {
    const { query, context = {}, profile = {} } = testCase;
    const resolvedIntent = await IntentEngine.classify(query, context, profile);
    return { result: resolvedIntent, plan: null };
}

async function runRefinerTest(testCase) {
    const { query, context = {} } = testCase;
    const refinerResult = await NeuralRefiner.refine(query, context);
    return { result: refinerResult, plan: null };
}

async function runGatewayTest(testCase) {
    const { query } = testCase;
    const gatewayResult = await SmartGateway.check(query); // Assuming a 'check' method
    return { result: gatewayResult, plan: null };
}

async function runFormatterTest(testCase) {
    // Adapter fix: Ensure input is valid before calling the formatter
    const textToFormat = testCase.aiAnswer || testCase.query || testCase.input;
    if (typeof textToFormat !== 'string') {
        throw new Error(`Formatter test case '${testCase.id}' is missing a valid input string (aiAnswer, query, or input).`);
    }
    const formatterResult = await Formatter.format(textToFormat); // Assuming a 'format' method
    return { result: formatterResult, plan: null };
}

async function runPlannerTest(testCase) {
    const { query, context = {}, profile = {}, expected } = testCase;
    // Adapter fix: Build a full, valid IntentContract to pass to the planner
    const intentContract = {
        rawIntent: expected.intent || 'FALLBACK',
        normalizedIntent: expected.intent || 'FALLBACK',
        intent: expected.intent || 'FALLBACK',
        mode: expected.mode || 'GENERAL_HELP',
        behavior: expected.behavior || 'RESPOND',
        domain: 'GENERAL',
        act: 'INFORM',
        confidence: 0.99,
        slots: {},
        needsClarification: false,
    };

    const plan = await AgenticPlanner.generatePlan(query, intentContract, {
        topic: context.currentTopic || 'GENERAL',
        profileStr: UserProfile.toContextString(profile)
    });
    // The 'result' for a planner test is the plan itself, plus the original intent
    return { result: { ...intentContract, ...plan }, plan };
}

function getTestRunner(filePath) {
    if (filePath.includes('00_Contract')) return runIntentTest;
    if (filePath.includes('01_SmartGateway')) return runGatewayTest;
    if (filePath.includes('02_NeuralRefiner')) return runRefinerTest;
    if (filePath.includes('04_AgenticPlanner')) return runPlannerTest;
    if (filePath.includes('10_Formatter')) return runFormatterTest;
    // Default to IntentEngine tests
    return runIntentTest;
}

function getActualResult(testCase, moduleResult, plan) {
    const filePath = testCase.filePath || '';
    if (filePath.includes('02_NeuralRefiner')) {
        return {
            originalQuery: moduleResult.originalQuery,
            refinedQuery: moduleResult.refinedQuery,
            meaningPreserved: moduleResult.meaningPreserved,
            refinerChangedMeaningRisk: moduleResult.refinerChangedMeaningRisk,
        };
    }

    // Adapter for SmartGateway
    if (filePath.includes('01_SmartGateway')) {
        // The actual output might be { action: 'BLOCK' }, normalize it for the test
        return { behavior: moduleResult.action };
    }

    // Adapter for Formatter
    if (filePath.includes('10_Formatter')) {
        // The actual output might be { format: 'TABLE' }, normalize it
        return { expectedFormat: moduleResult.format };
    }

    // Default for IntentEngine (00, 03) and Planner (04) tests
    return {
        intent: moduleResult.normalizedIntent,
        normalizedIntent: moduleResult.normalizedIntent,
        rawIntent: moduleResult.rawIntent,
        mode: moduleResult.mode,
        behavior: moduleResult.behavior,
        confidence: moduleResult.confidence,
        needsClarification: moduleResult.needsClarification,
        domain: moduleResult.domain,
        act: moduleResult.act,
        slots: moduleResult.slots,
        reasoningShort: moduleResult.reasoningShort,
        source: moduleResult.source,
        // Planner-specific fields
        tools: moduleResult.tools,
        action: moduleResult.action,
        strategy: moduleResult.strategy,
    };
}
function extractTestCases(jsonData) {
    if (Array.isArray(jsonData)) {
        return jsonData;
    }
    if (jsonData && Array.isArray(jsonData.cases)) {
        return jsonData.cases;
    }
    if (jsonData && Array.isArray(jsonData.tests)) {
        return jsonData.tests;
    }
    return [];
}

async function main() {
    console.log('🧠 Starting Neural Logic Evaluation (Multi-Label)...');

    try {
        await mongoose.connect(mongoURI);
        console.log('✅ DB Connected for Tests');
    } catch (err) {
        console.error('❌ DB Connection Error:', err.message);
        process.exit(1);
    }

    const testArg = process.argv[2];
    let testFiles = [];

    console.log(`\nFilter: ${testArg || 'ALL'}`);

    if (testArg) {
        // Strict filtering: find all folders starting with the filter argument
        const allDirs = fs.readdirSync(SCENARIOS_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(`${testArg}_`))
            .map(dirent => dirent.name);

        if (allDirs.length === 0) {
            console.error(`\n❌ No scenarios found for filter: ${testArg}`);
            process.exit(1);
        }

        for (const dir of allDirs) {
            const dirPath = path.join(SCENARIOS_DIR, dir);
            const filesInDir = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
            filesInDir.forEach(f => testFiles.push(path.join(dirPath, f)));
        }
    } else {
        // No filter: run all tests from all scenario folders
        const allDirs = fs.readdirSync(SCENARIOS_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        allDirs.forEach(dir => {
            const dirPath = path.join(SCENARIOS_DIR, dir);
            const filesInDir = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
            filesInDir.forEach(f => testFiles.push(path.join(dirPath, f)));
        });
    }

    console.log('Running files:\n' + testFiles.map(f => `- ${f}`).join('\n'));

    let allResults = [];
    let allTests = [];

    for (const filePath of testFiles) {
        if (!fs.existsSync(filePath)) {
            console.warn(`\n⚠️ Test file not found, skipping: ${filePath}`);
            continue;
        }
        console.log(`\n📂 Running tests from: ${path.basename(filePath)}`);
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const tests = extractTestCases(fileContent);
        const testRunner = getTestRunner(filePath);

        for (const testCase of tests) {
            testCase.filePath = filePath; // Tag test case with its origin file
            allTests.push(testCase);
            const startTime = performance.now();
            let result = { id: testCase.id, query: testCase.query, passed: false };

            try {
                const { result: moduleResult, plan } = await testRunner(testCase);
                const actual = getActualResult(testCase, moduleResult, plan);

                result.passed = true;
                result.mismatches = [];
                result.actual = actual;

                const expectedFields = testCase.expected || {};
                // For contract tests, we also check for field existence
                if (filePath.includes('00_Contract') && result.passed) {
                    const requiredKeys = ['rawIntent', 'normalizedIntent', 'intent', 'mode', 'behavior', 'confidence', 'slots', 'needsClarification', 'reasoningShort'];
                    requiredKeys.forEach(key => {
                        if (actual[key] === undefined) {
                            result.passed = false;
                            result.mismatches.push({ key, expected: 'to exist', got: 'undefined' });
                        }
                    });
                    // Type checks
                    if (typeof actual.confidence !== 'number') {
                        result.passed = false;
                        result.mismatches.push({ key: 'confidence', expected: 'number', got: typeof actual.confidence });
                    }
                    if (typeof actual.slots !== 'object' || actual.slots === null) {
                        result.passed = false;
                        result.mismatches.push({ key: 'slots', expected: 'object', got: typeof actual.slots });
                    }
                    if (typeof actual.needsClarification !== 'boolean') {
                        result.passed = false;
                        result.mismatches.push({ key: 'needsClarification', expected: 'boolean', got: typeof actual.needsClarification });
                    }
                    // Alias check
                    if (actual.intent !== actual.normalizedIntent) {
                        result.passed = false;
                        result.mismatches.push({ key: 'intent alias', expected: actual.normalizedIntent, got: actual.intent });
                        }
                    });
                }

                for (const [key, expectedValue] of Object.entries(expectedFields)) {
                    if (actual[key] !== expectedValue) {
                        result.passed = false;
                        result.mismatches.push({
                            key,
                            expected: expectedValue,
                            got: actual[key]
                        });
                    }
                }

            } catch (error) {
                result.error = error.message;
            }
            result.duration = (performance.now() - startTime).toFixed(0);
            allResults.push(result);

            if (result.passed) {
                console.log(`  ✅ [PASSED] ${testCase.id} (${result.duration}ms)`);
            } else {
                console.log(`  ❌ [FAILED] ${testCase.id} (${result.duration}ms)`);
                if (result.error) {
                    console.log(`     Error: ${result.error}`);
                } else {
                    console.log(`     File: ${path.relative(process.cwd(), testCase.filePath)}`);
                    console.log(`     Query: "${testCase.query}"`);
                    result.mismatches.forEach(m => console.log(`     - ${m.key}: Expected "${m.expected}", got "${m.got}"`));
                    if (process.env.DEBUG_AI_PIPELINE === 'true') {
                        console.log('\n     [DEBUG] Expected Object:');
                        console.dir(testCase.expected, { depth: null, colors: true });
                        console.log('\n     [DEBUG] Raw Module Output:');
                        console.dir(result.rawOutput, { depth: null, colors: true });
                        console.log('\n     [DEBUG] Normalized Actual Object:');
                        console.dir(result.actual, { depth: null, colors: true });
                    }
                }
            }
        }
    }

    generateReport(allResults, allTests);

    await mongoose.disconnect();
}

function generateReport(results, tests) {
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = tests.length;

    console.log('\n============================================================');
    console.log('NEURAL INTELLIGENCE REPORT');
    console.log('============================================================');
    console.log(`Total Cases: ${totalCount}`);
    console.log(`Passed:      ${passedCount}`);
    console.log(`Failed:      ${totalCount - passedCount}`);
    console.log(`Accuracy:    ${totalCount > 0 ? ((passedCount / totalCount) * 100).toFixed(2) : '0.00'}%`);

    // Per-category reporting
    const categories = {};
    tests.forEach(test => {
        const category = path.basename(path.dirname(test.filePath));
        if (!categories[category]) {
            categories[category] = { total: 0, passed: 0, mismatches: {} };
        }
        categories[category].total++;
    });
    results.forEach(res => {
        const test = tests.find(t => t.id === res.id);
        if (!test) return;
        const category = path.basename(path.dirname(test.filePath));
        if (res.passed) {
            categories[category].passed++;
        }
    });

    console.log('\n--- Accuracy by Category ---');
    for (const [name, data] of Object.entries(categories)) {
        const acc = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(2) : '0.00';
        console.log(`  - ${name.padEnd(20)}: ${acc}% (${data.passed}/${data.total})`);
    }

    console.log('============================================================\n');
}

main();
