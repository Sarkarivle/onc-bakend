const FORBIDDEN_PHRASES = [
    // Internal System Names & Logic
    'intent detected', 'resolvedintent', 'planner', 'policy', 'backend rule',
    'verified source recommended', 'database miss', 'internal database',
    'hallucination guard', 'search router', 'confidence score', 'validation failed',
    'sourceverified', 'pure greeting', 'greeting detected', 'general query classification',
    'llm fallback', 'semantic classifier', 'rule detector', 'promptcomposer',
    'knowledgerouter', 'runpod', 'cheerio', 'database first', 'internal json',
    'system prompt', 'developer message',

    // AI Self-Correction/Reasoning Leakage
    'maine system ki madad se', 'system ki madad se', 'as per my rule',
    'i must not guess', 'my instructions say', 'my prompt contains',
    'based on the provided context', 'the user is asking for',

    // Internal Intent/Domain Names (should not be exposed directly)
    'job_query', 'field_details', 'career_guidance', 'govt_job',
    'more_results', 'application_help', 'result_admit_card',

    // Generic Bad Fallbacks
    'user profile is missing',

    // Unprofessional Language
    'sapni wala data'
];

module.exports = { FORBIDDEN_PHRASES };