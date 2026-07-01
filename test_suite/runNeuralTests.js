/**
 * 🧠 Jobo AI - Deep Neural Pipeline Evaluation (Modular 2.0)
 * Location: vps_code/test_suite/runNeuralTests.js
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const AIOrchestrator = require('../src/features/ai/orchestrator/aiOrchestrator');
const IntentEngine = require('../src/features/ai/intent/intentEngine');
const SmartGateway = require('../src/features/ai/quality/smartGateway');
const EliteFormatter = require('../src/features/ai/quality/eliteFormatter');

const SCENARIOS_ROOT = path.join(__dirname, 'scenarios');
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/onc_db";

async function runTest(file, test) {
    let passed = false;
    let actual = null;

    try {
        if (file.includes('Gateway')) {
            const res = await SmartGateway.validate(test.query);
            actual = res.status;
            passed = actual === test.expected;
        }
        else if (file.includes('Intent_DeepDive')) {
            const res = await IntentEngine.classify(test.query);
            actual = res.primaryIntent;
            passed = actual === test.expectedIntent;
        }
        else {
            // Full Pipeline Test for Planner and Quality
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
    console.log('============================================================');
    console.log('🏁 JOBO AI - DEEP MODULAR EVALUATION (200+ CASES)');
    console.log('============================================================');

    try {
        await mongoose.connect(mongoURI);
        await SmartGateway.initialize();
    } catch (err) {
        process.exit(1);
    }

    const categories = fs.readdirSync(SCENARIOS_ROOT);
    const finalReport = [];

    for (const cat of categories) {
        const catPath = path.join(SCENARIOS_ROOT, cat);
        if (!fs.lstatSync(catPath).isDirectory()) continue;

        console.log(`\n📂 Category: ${cat}`);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const scenarios = JSON.parse(fs.readFileSync(path.join(catPath, file), 'utf8'));
            let filePassed = 0;

            console.log(`   📄 Testing ${file} (${scenarios.length} cases)`);

            for (const test of scenarios) {
                const res = await runTest(path.join(cat, file), test);
                if (res.passed) filePassed++;
                process.stdout.write(res.passed ? '✅' : '❌');
            }

            const score = ((filePassed / scenarios.length) * 100).toFixed(0);
            console.log(` -> ${score}%`);
            finalReport.push({ name: `${cat}/${file}`, total: scenarios.length, passed: filePassed });
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL NEURAL INTELLIGENCE REPORT');
    console.log('='.repeat(60));

    finalReport.forEach(r => {
        const bar = '█'.repeat(Math.round((r.passed/r.total)*10)) + '░'.repeat(10 - Math.round((r.passed/r.total)*10));
        console.log(`${r.name.padEnd(35)} | ${bar} | ${r.passed}/${r.total}`);
    });

    console.log('='.repeat(60));
    const grandTotal = finalReport.reduce((a, b) => a + b.total, 0);
    const grandPassed = finalReport.reduce((a, b) => a + b.passed, 0);
    console.log(`TOTAL SCORE: ${grandPassed}/${grandTotal} (${((grandPassed/grandTotal)*100).toFixed(2)}%)`);
    console.log('='.repeat(60) + '\n');

    await mongoose.disconnect();
}

scanAndTest();
