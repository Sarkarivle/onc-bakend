const backendLeakPhrases = [
    'intent detected', 'resolvedintent', 'planner', 'backend rule',
    'internal database', 'database miss',
    'hallucination guard', 'search router', 'confidence score', 'validation failed',
    'sourceverified', 'system prompt', 'promptcomposer',
    'knowledgerouter', 'llm intent', 'semanticintentclassifier',
    'followupresolver', 'ai_metrics',
    'referenceerror', 'typeerror', 'undefined is not defined',
    // Less critical but still internal
    'stack trace', 'internal json', 'developer message'
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