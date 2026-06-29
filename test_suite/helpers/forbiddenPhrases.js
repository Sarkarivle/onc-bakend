const backendLeakPhrases = [
    'intent detected', 'resolvedintent', 'planner', 'policy', 'backend rule',
    'verified source recommended', 'database miss', 'internal database',
    'hallucination guard', 'search router', 'confidence score', 'validation failed',
    'sourceverified', 'pure greeting', 'greeting detected', 'general query classification',
    'llm fallback', 'semantic classifier', 'rule detector', 'promptcomposer',
    'knowledgerouter', 'runpod', 'cheerio', 'database first', 'internal json',
    'system prompt', 'developer message', 'ai_metrics', 'stack trace',
    'referenceerror', 'typeerror', 'llm intent', 'semanticintentclassifier',
    'followupresolver',
];

const fakeFactRiskPhrases = [
    'official website is',
    'last date is',
    'vacancy is',
    'salary is',
    'fee is',
    'age limit is',
    'apply link is'
];

module.exports = {
    backendLeakPhrases,
    fakeFactRiskPhrases
};