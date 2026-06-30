/**
 * ForbiddenPhrases Module
 * Responsibility: List of phrases that should not appear in AI responses.
 */
const FORBIDDEN_PHRASES = [
    'intent detected', 'resolvedintent', 'planner', 'policy', 'backend rule',
    'verified source recommended', 'database miss', 'internal database',
    'hallucination guard', 'search router', 'confidence score', 'validation failed',
    'sourceverified', 'pure greeting', 'greeting detected', 'general query classification',
    'llm fallback', 'semantic classifier', 'rule detector', 'promptcomposer',
    'knowledgerouter', 'runpod', 'cheerio', 'database first', 'internal json',
    'system prompt', 'developer message',
    'maine system ki madad se', 'system ki madad se', 'as per my rule',
    'i must not guess', 'my instructions say', 'my prompt contains',
    'based on the provided context', 'the user is asking for',
    'job_query', 'field_details', 'career_guidance', 'govt_job',
    'more_results', 'application_help', 'result_admit_card',
    'user profile is missing',
    'sapni wala data'
];

module.exports = { FORBIDDEN_PHRASES };
