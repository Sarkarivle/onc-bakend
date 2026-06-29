const QueryNormalizer = require('./queryNormalizer');
const EntityExtractor = require('./entityExtractor');

function runNormalize(q) {
  if (QueryNormalizer?.normalize) return QueryNormalizer.normalize(q);
  if (typeof QueryNormalizer === 'function') {
    try {
      const inst = new QueryNormalizer();
      if (inst.normalize) return inst.normalize(q);
    } catch (_) {}
  }
  return { normalizedText: String(q || '').toLowerCase().trim() };
}

function runEntities(q) {
  if (EntityExtractor?.extract) return EntityExtractor.extract(q);
  if (EntityExtractor?.extractEntities) return EntityExtractor.extractEntities(q);
  if (typeof EntityExtractor === 'function') {
    try {
      const inst = new EntityExtractor();
      if (inst.extract) return inst.extract(q);
      if (inst.extractEntities) return inst.extractEntities(q);
    } catch (_) {}
  }
  return {};
}

function has(text, pattern) {
  return pattern.test(text);
}

function interpret(input) {
  const originalQuery = typeof input === 'string'
    ? input
    : String(input?.query || input?.message || input?.userMessage || input?.text || '');

  const norm = runNormalize(originalQuery);
  const normalizedQuery = norm.normalizedText || originalQuery.toLowerCase().trim();
  const text = normalizedQuery;

  const entities = runEntities(normalizedQuery);
  const reasoningSignals = [];

  let domain = 'GENERAL';
  if (has(text, /\b(police|pulis|daroga|constable)\b/)) domain = 'police';
  else if (has(text, /\b(railway|rrb|ntpc|group d)\b/)) domain = 'railway';
  else if (has(text, /\b(ssc|cgl)\b/)) domain = 'ssc';
  else if (has(text, /\bbank\b/)) domain = 'bank';
  else if (has(text, /\b(teacher|ctet|tet)\b/)) domain = 'teacher';
  else if (has(text, /\barmy|agniveer\b/)) domain = 'army';
  else if (has(text, /\bupsc\b/)) domain = 'upsc';

  let requestedField = null;
  if (has(text, /\bage|umar|age limit\b/)) requestedField = 'age';
  else if (has(text, /\bsalary|sallery|vetan|pay\b/)) requestedField = 'salary';
  else if (has(text, /\bfees|fee|form fees\b/)) requestedField = 'fees';
  else if (has(text, /\blast date|last det\b/)) requestedField = 'last_date';
  else if (has(text, /\bapply link|official link|website|site\b/)) requestedField = 'apply_link';
  else if (has(text, /\beligibility|qualification|yogyata\b/)) requestedField = 'eligibility';
  else if (has(text, /\bsyllabus\b/)) requestedField = 'syllabus';
  else if (has(text, /selection process|selection|process|chayan prakriya|selection kaise/)) requestedField = 'selection_process';

  let intent = 'GENERAL_QUERY';

  if (has(text, /\b(namaste|hello|hi|hey|hii)\b/)) {
    intent = 'GREETING';
  } else if (has(text, /\bscholarship\b/)) {
    intent = 'SCHOLARSHIP';
  } else if (has(text, /\bresume|cv\b/)) {
    intent = 'RESUME_HELP';
  } else if (has(text, /\b(result|cutoff|admit card)\b/)) {
    intent = 'RESULT_ADMIT_CARD';
  } else if (
    has(text, /\bhow to become\b/) ||
    has(text, /\bkaise ban|kaise banu|kya karu|12th ke baad|career|doctor|engineer\b/)
  ) {
    intent = 'CAREER_GUIDANCE';
  } else if (requestedField) {
    intent = 'FIELD_DETAILS';
  } else if (domain !== 'GENERAL' && has(text, /selection process|selection|process|eligibility|syllabus|kya hai|kaise hai/)) {
    intent = 'FIELD_DETAILS';
  } else if (
    has(text, /\b(job|vacancy|bharti|naukri|option|options)\b/) ||
    (domain !== 'GENERAL' && has(text, /\bkya option|option hai\b/))
  ) {
    intent = 'JOB_QUERY';
  }

  if (has(text, /\bgraduate|graduation\b/) && domain !== 'GENERAL' && has(text, /\boption|job|vacancy|naukri\b/)) {
    intent = 'JOB_QUERY';
  }

  const vague = has(text, /^(batao|kuch bhi|details|help)$/) || text.length < 4;
  const needsClarification = vague || intent === 'GENERAL_QUERY';

  let confidence = 50;
  if (intent !== 'GENERAL_QUERY') confidence += 20;
  if (domain !== 'GENERAL') confidence += 15;
  if (requestedField) confidence += 15;
  if (Object.keys(entities).length) confidence += 10;
  if (needsClarification) confidence = Math.min(confidence, 60);
  confidence = Math.max(0, Math.min(100, confidence));

  if (intent !== 'GENERAL_QUERY') reasoningSignals.push(`Intent matched on ${intent}`);
  if (domain !== 'GENERAL') reasoningSignals.push(`Domain matched on ${domain}`);
  if (requestedField) reasoningSignals.push(`Field detected: ${requestedField}`);
  if (Object.keys(entities).length) reasoningSignals.push('Entities found');

  return {
    originalQuery,
    normalizedQuery,
    intent,
    domain,
    entities,
    requestedField,
    confidence,
    reasoningSignals,
    needsClarification
  };
}

module.exports = {
  interpret,
  analyze: interpret,
  default: interpret
};
