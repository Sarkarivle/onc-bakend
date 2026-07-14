const assert = require('assert');

const SmartGateway = require('../src/features/ai/quality/smartGateway');
const VectorService = require('../src/features/ai/knowledge/vectorService');
const ValidationEngine = require('../src/features/ai/quality/validationEngine');
const LLMProvider = require('../src/features/ai/generation/core_engine/llmProvider');

async function test(name, fn) {
    const start = Date.now();
    try {
        await fn();
        console.log(`✅ ${name} (${Date.now() - start}ms)`);
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   ${error.message}`);
        process.exitCode = 1;
    }
}

function classifyFast(query) {
    const q = String(query || '').toLowerCase().trim();
    if (/^(hi\b|hello\b|hey\b|namaste\b)/i.test(q)) return { intent: 'GREETING', mode: 'GENERAL_HELP' };
    if (/fee|fees|age limit|last date|syllabus|salary|qualification|\bdetails?\b/i.test(q)) return { intent: 'FIELD_DETAILS', mode: 'JOB_DETAILS' };
    if (/job|jobs|vacancy|sarkari|naukri|bharti|ssc|railway|bank|army|recruitment/i.test(q)) return { intent: 'JOB_SEARCH', mode: 'JOB_SEARCH' };
    if (/career|kaise bane|after|baad|scope|skills/i.test(q)) return { intent: 'CAREER_GUIDANCE', mode: 'CAREER_GUIDANCE' };
    return { intent: 'GENERAL_QUERY', mode: 'GENERAL_HELP' };
}

function resetProvider() {
    LLMProvider.resetStats();
}

async function main() {
    await test('smart gateway initializes and handles greetings without LLM', async () => {
        resetProvider();
        await SmartGateway.initialize();
        const result = await SmartGateway.validate('hello');
        assert.strictEqual(result.status, 'GREET');
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    await test('fast classifier avoids broad hi false positives', async () => {
        resetProvider();
        const result = classifyFast('highest paying jobs');
        assert.strictEqual(result.mode, 'JOB_SEARCH');
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    await test('field detail classification is deterministic', async () => {
        const result = classifyFast('SSC CGL fees');
        assert.strictEqual(result.intent, 'FIELD_DETAILS');
        assert.strictEqual(result.mode, 'JOB_DETAILS');
    });

    await test('vector service returns cached deterministic vectors', async () => {
        const first = await VectorService.generate('railway vacancy');
        const second = await VectorService.generate('railway vacancy');
        assert.ok(Array.isArray(first));
        assert.strictEqual(first, second);
        assert.strictEqual(first.length, VectorService.VECTOR_SIZE);
    });

    await test('stream validation kills internal thought leaks', async () => {
        const result = ValidationEngine.validateStreamChunk('<AGENT_THOUGHT>secret</AGENT_THOUGHT>');
        assert.strictEqual(result.status, 'KILL');
    });

    await test('output validation can run in no-LLM mode', async () => {
        resetProvider();
        const status = await ValidationEngine.validateOutput(
            'railway vacancy',
            'Railway Group D last date is Soon.',
            { jobs: '- [Railway Group D] | Org: RRB | Last Date: Soon' },
            { allowLlm: false }
        );
        assert.strictEqual(status.status, 'PROCEED');
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    if (process.exitCode) process.exit(process.exitCode);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
