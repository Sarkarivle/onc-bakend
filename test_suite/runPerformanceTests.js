const assert = require('assert');

const IntentEngine = require('../src/features/ai/intent/intentEngine');
const RetrievalEngine = require('../src/features/ai/knowledge/retrievalEngine');
const SearchReranker = require('../src/features/ai/knowledge/searchReranker');
const LLMProvider = require('../src/features/ai/generation/core_engine/llmProvider');
const ValidationEngine = require('../src/features/ai/quality/validationEngine');

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

function resetProvider() {
    LLMProvider.resetStats();
}

async function main() {
    const originalGenerateLogic = LLMProvider.generateLogic;
    const originalStandardSearch = RetrievalEngine._standardSearch;
    const originalRerank = SearchReranker.rank;

    await test('simple greeting uses 0 planner LLM calls', async () => {
        resetProvider();
        const plan = await IntentEngine.classify('hello');
        assert.strictEqual(plan.intent, 'GREETING');
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    await test('clear field detail uses 0 planner LLM calls', async () => {
        resetProvider();
        const plan = await IntentEngine.classify('SSC CGL fees');
        assert.strictEqual(plan.intent, 'FIELD_DETAILS');
        assert.strictEqual(plan.needsPlanning, false);
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    await test('normal job search skips expansion and reranker LLM', async () => {
        resetProvider();
        const plan = await IntentEngine.classify('railway vacancy');
        let rerankerCalled = false;

        RetrievalEngine._standardSearch = async () => ([{
            _id: 'job1',
            title: 'Railway Group D',
            organization: 'RRB',
            category: 'Railway',
            createdAt: new Date(),
            importantDates: { applicationLastDate: 'Soon' },
            eligibility: { education: '10th' }
        }]);
        SearchReranker.rank = async () => {
            rerankerCalled = true;
            return [];
        };

        const result = await RetrievalEngine.searchJobs('railway vacancy', {}, plan);
        assert.strictEqual(rerankerCalled, false);
        assert.strictEqual(result.count, 1);
        assert.strictEqual(LLMProvider.getStats().total, 0);
    });

    await test('fast RAG validation does not add a second LLM call', async () => {
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

    await test('complex request allows planner LLM and logs reason', async () => {
        resetProvider();
        LLMProvider.generateLogic = async () => {
            LLMProvider.callStats.logic++;
            LLMProvider.callStats.total++;
            return {
                intent: 'CAREER_GUIDANCE',
                confidence: 0.72,
                refinedQuery: 'compare UPSC and SSC with user profile',
                needsPlanning: true,
                parallel: false,
                shouldClarify: false,
                execution: [{ step: 1, tool: 'LLM', purpose: 'complex comparison' }],
                reasoning: 'Complex comparison needs semantic planning'
            };
        };

        const plan = await IntentEngine.classify('compare UPSC and SSC for a commerce student and tell best path');
        assert.strictEqual(plan.intent, 'CAREER_GUIDANCE');
        assert.strictEqual(LLMProvider.getStats().logic, 1);
        console.log(`   reason: ${plan.reasoning}`);
    });

    RetrievalEngine._standardSearch = originalStandardSearch;
    SearchReranker.rank = originalRerank;
    LLMProvider.generateLogic = originalGenerateLogic;

    if (process.exitCode) process.exit(process.exitCode);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
