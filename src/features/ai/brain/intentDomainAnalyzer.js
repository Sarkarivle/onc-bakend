function analyze(input) {
  const text = String(input?.normalizedText || input?.query || input?.message || input?.userMessage || input || '').toLowerCase();

  let detectedDomain = null;
  if (/police|pulis/.test(text)) detectedDomain = 'police';
  else if (/railway|rrb/.test(text)) detectedDomain = 'railway';
  else if (/ssc|cgl/.test(text)) detectedDomain = 'ssc';
  else if (/bank/.test(text)) detectedDomain = 'bank';

  let primaryIntent = 'GENERAL_QUERY';
  if (/^(hi|hello|namaste|hey|hii|bhai)/.test(text) || /namaste/.test(text)) primaryIntent = 'GREETING';
  else if (/resume|cv/.test(text)) primaryIntent = 'RESUME';
  else if (/result|cutoff|admit card/.test(text)) primaryIntent = 'RESULT_ADMIT_CARD';
  else if (/career|kaise bane|kya karu|12th ke baad/.test(text)) primaryIntent = 'CAREER_GUIDANCE';
  else if (/job|vacancy|bharti|naukri/.test(text)) primaryIntent = 'JOB_QUERY';

  return {
    primaryIntent,
    intent: primaryIntent,
    detectedDomain,
    domain: detectedDomain,
    confidence: primaryIntent === 'GENERAL_QUERY' ? 0.55 : 0.85,
    reason: 'rule based semantic signal'
  };
}

module.exports = { analyze, detect: analyze, default: analyze };
