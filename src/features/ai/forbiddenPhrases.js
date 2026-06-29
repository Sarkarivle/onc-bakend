const FORBIDDEN_PHRASES = [
    // Internal System Names
    'intent detected', 'resolvedintent', 'planner', 'policy', 'backend rule',
    'verified source recommended', 'database miss', 'internal database',
    'hallucination guard', 'search router', 'confidence score', 'validation failed',
    'sourceverified', 'pure greeting', 'greeting detected', 'general query classification',
    'llm fallback', 'semantic classifier', 'rule detector', 'promptcomposer',
    'knowledgerouter', 'runpod', 'cheerio',

    // AI Self-Correction/Reasoning Leakage
    'maine system ki madad se', 'system ki madad se', 'as per my rule',
    'i must not guess', 'my instructions say', 'my prompt contains',
    'based on the provided context', 'the user is asking for',

    // Internal Intent/Domain Names
    'job_query', 'field_details', 'career_guidance', 'govt_job',
    'more_results', 'application_help',

    // Generic Bad Fallbacks
    'user profile is missing'
];

module.exports = { FORBIDDEN_PHRASES };