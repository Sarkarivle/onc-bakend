/**
 * 🧠 Jobo AI - Deep Neural Pipeline Evaluation (Modular 3.0)
 * Location: vps_code/test_suite/runNeuralTests.js
 *
 * Usage:
 * node runNeuralTests.js all          - Run all 200+ tests
 * node runNeuralTests.js 01           - Run only SmartGateway tests
 * node runNeuralTests.js 03           - Run only Intent Engine tests
 * node runNeuralTests.js formatter    - Run only EliteFormatter tests
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Load Pipeline Modules
const AIOrchestrator = require('../src/features/ai/orchestrator/aiOrchestrator');
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const SmartGateway = require('../src/features/ai/quality/smartGateway');
const AgenticPlanner = require('../src/features/ai/reasoning/agenticPlanner');
const RetrievalEngine = require('../src/features/ai/knowledge/retrievalEngine');
const LLMProvider = require('../src/features/ai/generation/llmProvider');
const EliteFormatter = require('../src/features/ai/quality/eliteFormatter');
const PromptComposer = require('../src/features/ai/generation/promptComposer');

const SCENARIOS_ROOT = path.join(__dirname, 'scenarios');
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

async function runTest(categoryName, fileName, test) {
    let passed = false;
    let actual = null;

    try {
        // PHASE 01: SmartGateway
        if (categoryName.includes('01_SmartGateway')) {
            const res = await SmartGateway.validate(test.query);
            actual = res.status;
            passed = actual === test.expected;
        }
        // PHASE 02: NeuralRefiner
        else if (categoryName.includes('02_NeuralRefiner')) {
            const res = await IntentEngine.classify(test.query, test.context || {});
            actual = res.refinedQuery.toLowerCase();
            passed = (test.expectedContains || []).every(word => actual.includes(word.toLowerCase()));
        }
        // PHASE 03: IntentEngine
        else if (categoryName.includes('03_IntentEngine')) {
            const res = await IntentEngine.classify(test.query);
            actual = res.primaryIntent;
            passed = actual === test.expected.intent;
        }
        // PHASE 04: AgenticPlanner
        else if (categoryName.includes('04_AgenticPlanner')) {
            const intent = await IntentEngine.classify(test.query);
            const res = await AgenticPlanner.generatePlan(test.query, intent);
            actual = { needsDatabase: res.needsDatabase, mode: res.mode };
            passed = actual.needsDatabase === test.expected.needsDatabase && actual.mode === test.expected.mode;
        }
        // PHASE 05: Retrieval
        else if (categoryName.includes('05_Retrieval')) {
            const res = await RetrievalEngine.searchJobs(test.query);
            actual = res.count > 0;
            passed = actual === test.expectedFound;
        }
        // PHASE 06: Reasoning
        else if (categoryName.includes('06_Reasoning')) {
            const res = await LLMProvider.generateReasoning(test.query);
            actual = typeof res === 'string' && res.length > 10;
            passed = actual;
        }
        // PHASE 07: PromptComposer
        else if (categoryName.includes('07_PromptComposer')) {
            const res = await PromptComposer.build([], test.profile || {}, {}, { sessionId: 'test', turnCount: 1 });
            actual = typeof res === 'string' && res.length > 100;
            passed = actual;
        }
        // PHASE 08: Generation
        else if (categoryName.includes('08_Generation')) {
            const res = await LLMProvider.chat([{ role: 'user', content: test.query }]);
            actual = res.content;
            passed = typeof actual === 'string' && actual.length > 5;
        }
        // PHASE 09: Verification
        else if (categoryName.includes('09_Verification')) {
            const res = await LLMProvider.verifyResponse(test.query, test.aiAnswer, test.knowledge);
            actual = res.isValid;
            passed = actual === test.expectedValid;
        }
        // PHASE 10: Formatter
        else if (categoryName.includes('10_Formatter')) {
            const res = EliteFormatter.format(test.aiAnswer, { intent: 'JOB_QUERY' });
            if (test.expectedFormat === 'TABLE') passed = res.includes('|') && res.includes('---');
            else if (test.expectedFormat === 'ROADMAP') passed = res.includes('🚀 Step:');
            else if (test.expectedFormat === 'CHECKLIST') passed = res.includes('✅');
            else passed = true;
            actual = "UI Check Complete";
        }
        else {
            const res = await AIOrchestrator.processRequest({ userMessage: test.query });
            actual = res.success ? "SUCCESS" : "FAILED";
            passed = res.success;
        }
        return { passed, actual };
    } catch (err) {
        return { passed: false, actual: 'ERROR', error: err.message };
    }
}

async function scanAndTest() {
    const filter = process.argv[2] || 'all';

    console.log('============================================================');
    console.log(`🏁 JOBO AI - MODULAR EVALUATION (Filter: ${filter.toUpperCase()})`);
    console.log('============================================================');

    try {
        await mongoose.connect(mongoURI);
        await SmartGateway.initialize();
    } catch (err) {
        console.error("🔴 DB Connection Failed:", err.message);
        process.exit(1);
    }

    let categories = fs.readdirSync(SCENARIOS_ROOT).filter(cat => {
        const catPath = path.join(SCENARIOS_ROOT, cat);
        if (!fs.lstatSync(catPath).isDirectory()) return false;

        if (filter === 'all') return true;
        return cat.startsWith(filter) || cat.toLowerCase().includes(filter.toLowerCase());
    }).sort();

    if (categories.length === 0) {
        console.log(`❌ No modules found matching: "${filter}"`);
        await mongoose.disconnect();
        return;
    }

    const finalReport = [];

    for (const cat of categories) {
        const catPath = path.join(SCENARIOS_ROOT, cat);
        console.log(`\n📂 Category: ${cat}`);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const scenarios = JSON.parse(fs.readFileSync(path.join(catPath, file), 'utf8'));
            let filePassed = 0;

            process.stdout.write(`   📄 ${file} [`);

            for (const test of scenarios) {
                const res = await runTest(cat, file, test);
                if (res.passed) filePassed++;
                process.stdout.write(res.passed ? '✅' : '❌');
            }

            const score = ((filePassed / scenarios.length) * 100).toFixed(0);
            process.stdout.write(`] -> ${score}%\n`);
            finalReport.push({ name: `${cat}/${file}`, total: scenarios.length, passed: filePassed });
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 NEURAL INTELLIGENCE REPORT');
    console.log('='.repeat(60));

    finalReport.forEach(r => {
        const bar = '█'.repeat(Math.round((r.passed/r.total)*10)) + '░'.repeat(10 - Math.round((r.passed/r.total)*10));
        console.log(`${r.name.padEnd(45)} | ${bar} | ${r.passed}/${r.total}`);
    });

    const grandTotal = finalReport.reduce((a, b) => a + b.total, 0);
    const grandPassed = finalReport.reduce((a, b) => a + b.passed, 0);

    console.log('='.repeat(60));
    console.log(`TOTAL SCORE: ${grandPassed}/${grandTotal} (${((grandPassed/grandTotal)*100).toFixed(2)}%)`);
    console.log('='.repeat(60) + '\n');

    await mongoose.disconnect();
    process.exit(grandPassed === grandTotal ? 0 : 1);
}

scanAndTest();
