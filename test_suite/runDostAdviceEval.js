/**
 * Regression eval for the "Dost Advice" LLM prompt. Run this BEFORE deploying
 * any change to src/features/eligibility/prompts/expert_reasoning.js so you
 * can see, side by side, whether the new prompt broke something that used
 * to work - instead of finding out from real-user downvotes.
 *
 * This makes real LLM calls (costs tokens) and connects to Mongo so the
 * generated advice gets logged like a real request. Not meant for CI.
 *
 * Usage: npm run test:dost-advice
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EligibilityEngine = require('../src/features/eligibility/EligibilityEngine');
const HumanExpertEngine = require('../src/features/eligibility/HumanExpertEngine');
const cases = require('./dostAdviceGoldenCases');
const fs = require('fs');
const path = require('path');

const BULLET_REGEX = /(^|\n)\s*[-*•]\s/;

function checkStructure(advice, testCase) {
    const checks = [];

    checks.push({
        label: 'no_bullets',
        pass: !BULLET_REGEX.test(advice.details || ''),
        detail: 'Details must not use bullet/list formatting (prompt rule #1).',
    });

    const firstName = testCase.user.name.split(' ')[0];
    checks.push({
        label: 'personalized',
        pass: (advice.details || '').includes(firstName),
        detail: `Details should address "${firstName}" by name (prompt rule #3).`,
    });

    checks.push({
        label: 'banner_short',
        pass: !!advice.banner && advice.banner.split(/\s+/).length <= 10,
        detail: 'Banner should be a short 1-line hook (prompt rule #7).',
    });

    checks.push({
        label: 'ends_with_question',
        pass: /\?/.test(advice.details || ''),
        detail: 'Details should end with the permission question (prompt rule #7).',
    });

    return checks;
}

async function run() {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/onc_db';
    try {
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
        console.log(`✅ Connected to Mongo (advice will be logged like a real request)\n`);
    } catch (e) {
        console.log(`⚠️  Mongo not reachable (${e.message}) - continuing without persistence.\n`);
    }

    console.log(`Prompt version under test: ${HumanExpertEngine.PROMPT_VERSION}\n`);
    console.log('='.repeat(70));

    const results = [];
    let structuralPass = 0;

    for (const tc of cases) {
        const report = await EligibilityEngine.evaluate(tc.user, tc.job, { skipLLM: true });
        const advice = await HumanExpertEngine.generateDostAdvice(tc.user, report, tc.job.title, tc.job);

        const hardBlockerCount = report.failed_rules.filter(r => ['AGE', 'EDUCATION', 'GENDER', 'PHYSICAL'].includes(r.module)).length;
        const engineMatchesExpectation = tc.expectHardBlockers ? hardBlockerCount > 0 : hardBlockerCount === 0;

        const checks = checkStructure(advice, tc);
        const allChecksPassed = checks.every(c => c.pass);
        if (allChecksPassed) structuralPass++;

        console.log(`\n📋 ${tc.name}`);
        console.log(`   ${tc.description}`);
        console.log(`   Engine: status=${report.status} hard_blockers=${hardBlockerCount} (expected ${tc.expectHardBlockers ? '>0' : '0'}) ${engineMatchesExpectation ? '✅' : '❌ MISMATCH - fixture or rule engine issue'}`);
        checks.forEach(c => console.log(`   ${c.pass ? '✅' : '❌'} ${c.label} - ${c.detail}`));
        console.log(`   --- BANNER ---\n   ${advice.banner}`);
        console.log(`   --- DETAILS (read this for tone - hard_blockers should read as disqualifying, not "chhota sa maamla") ---\n   ${(advice.details || '').replace(/\n/g, '\n   ')}`);

        results.push({ name: tc.name, engineMatchesExpectation, hardBlockerCount, checks, banner: advice.banner, details: advice.details, logId: advice.logId });
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Structural checks: ${structuralPass}/${cases.length} cases fully passed.`);
    console.log('Tone/wording correctness above needs a human read - LLM phrasing varies run to run.');

    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
    const outFile = path.join(resultsDir, `dostAdviceEval-${HumanExpertEngine.PROMPT_VERSION}-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ promptVersion: HumanExpertEngine.PROMPT_VERSION, timestamp: new Date().toISOString(), results }, null, 2));
    console.log(`Saved run to ${outFile} - diff this against a previous run before/after a prompt change.`);

    await mongoose.disconnect().catch(() => {});
}

run().catch(err => {
    console.error('Eval run failed:', err);
    process.exit(1);
});
