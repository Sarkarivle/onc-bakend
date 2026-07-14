const assert = require('assert');

const SmartGateway = require('../src/features/ai/quality/smartGateway');
const VectorService = require('../src/features/ai/knowledge/vectorService');
const ValidationEngine = require('../src/features/ai/quality/validationEngine');
const LLMProvider = require('../src/features/ai/generation/core_engine/llmProvider');
const MasterOrchestrator = require('../src/features/ai/orchestrator/MasterOrchestrator');
const AgentLoop = require('../src/features/ai/reasoning/agentLoop');
const Grounding = require('../src/features/ai/quality/grounding');
const EliteFormatter = require('../src/features/ai/quality/eliteFormatter');
const SourceService = require('../src/features/sources/sourceService');

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

    await test('master routing exposes student specialist tool categories', async () => {
        const scholarship = MasterOrchestrator._finalizeIntents(['GENERAL'], 'up scholarship for obc student');
        const internship = MasterOrchestrator._finalizeIntents(['GENERAL'], 'paid internship work from home');
        const local = MasterOrchestrator._finalizeIntents(['GENERAL'], 'library near me for ssc preparation');

        assert.ok(scholarship.includes('GRANTS'));
        assert.ok(internship.includes('PART_TIME'));
        assert.ok(local.includes('LOCAL_SCOUT'));
    });

    await test('agent loop uses deeper output contract for student planning queries', async () => {
        const depth = AgentLoop._responseDepth('12th ke baad kya karu full roadmap batao', ['ROADMAP']);
        const contract = AgentLoop._buildOutputContract(depth, ['ROADMAP'], { qualification: '12th Pass' });

        assert.strictEqual(depth, 'deep');
        assert.ok(AgentLoop._maxTokensForDepth(depth) >= 2500);
        assert.ok(contract.includes('30/60/90-day roadmap'));
        assert.ok(contract.includes('Do not force exactly 3 tasks'));
    });

    await test('formatter does not force roadmap numbers or generic closing', async () => {
        const answer = '1. Science path dekho.\\n\\n2. Commerce path dekho.';
        const formatted = EliteFormatter.format(answer, { intent: 'CAREER_GUIDANCE', userProfile: { name: 'Test' } });

        assert.ok(formatted.includes('1. Science path'));
        assert.ok(!formatted.includes('🚀 Step:'));
        assert.ok(!formatted.includes('Aur kuch?'));
        assert.ok(!formatted.includes('tera bhai yahi hai'));
    });

    await test('vector service returns cached deterministic vectors', async () => {
        const first = await VectorService.generate('railway vacancy');
        const second = await VectorService.generate('railway vacancy');
        assert.ok(Array.isArray(first));
        assert.strictEqual(first, second);
        assert.strictEqual(first.length, VectorService.VECTOR_SIZE);
    });

    await test('semantic scorer connects Hinglish job queries to job text', async () => {
        const score = await VectorService.scoreTextPair(
            'sarkari naukri railway bharti',
            'Railway Group D government recruitment vacancy for 10th pass students'
        );
        assert.ok(score > 0.1, `expected semantic score > 0.1, got ${score}`);
    });

    await test('stream validation kills internal thought leaks', async () => {
        const result = ValidationEngine.validateStreamChunk('<AGENT_THOUGHT>secret</AGENT_THOUGHT>');
        assert.strictEqual(result.status, 'KILL');
    });

    await test('grounding marks government domains as official', async () => {
        const evidence = Grounding.fromSearchResult({
            title: 'SSC official',
            link: 'https://ssc.gov.in',
            snippet: 'Official portal'
        }, 'Search');
        assert.strictEqual(evidence.verified, true);
        assert.ok(evidence.confidence >= 0.9);
    });

    await test('formatter appends verification footer for factual answers', async () => {
        const formatted = EliteFormatter.format('SSC CGL details mil gaye.', {
            intent: 'JOB_SEARCH',
            evidence: [Grounding.fromSearchResult({ title: 'SSC', link: 'https://ssc.gov.in' }, 'Search')]
        });
        assert.ok(formatted.includes('Verification Sources'));
        assert.ok(formatted.includes('ssc.gov.in'));
    });

    await test('source freshness extractor hashes visible official content', async () => {
        const extracted = SourceService.extract('<html><head><title>SSC Notice</title></head><body><script>x</script><h1>Recruitment</h1><p>Last date 31 July</p></body></html>');
        assert.strictEqual(extracted.title, 'SSC Notice');
        assert.ok(extracted.text.includes('Last date 31 July'));
        assert.strictEqual(SourceService.hash(extracted.text).length, 64);
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
