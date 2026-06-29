function plan(input) {
  const text = String(input?.query || input?.message || input?.userMessage || input?.normalizedText || input || '').toLowerCase();

  if (/career|kaise bane|12th ke baad|kya karu|doctor|engineer|teacher/.test(text)) {
    return { action: 'DIRECT_ANSWER', shouldSearchDB: false };
  }

  if (/job|vacancy|bharti|naukri|police|railway|ssc|bank/.test(text)) {
    return { action: 'DATABASE_SEARCH', shouldSearchDB: true, searchType: 'JOB_SEARCH' };
  }

  return { action: 'CLARIFY_OR_FALLBACK', shouldSearchDB: false };
}

module.exports = { plan, analyze: plan, default: plan };
