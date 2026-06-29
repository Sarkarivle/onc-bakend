function toProfile(input) {
  if (typeof input === 'object' && input !== null) return input;

  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (_) {
      return { intent: 'GENERAL_QUERY', domain: 'GENERAL', entities: {}, confidence: 50, needsClarification: true };
    }
  }

  return { intent: 'GENERAL_QUERY', domain: 'GENERAL', entities: {}, confidence: 50, needsClarification: true };
}

function plan(input) {
  const profile = toProfile(input);

  const intent = profile.intent || profile.primaryIntent || 'GENERAL_QUERY';
  const domain = profile.domain || profile.detectedDomain || 'GENERAL';
  const entities = profile.entities || {};
  const confidence = profile.confidence?.score || profile.confidence || 50;
  const needsClarification = profile.needsClarification || confidence < 60;

  if (needsClarification) {
    return {
      action: 'CLARIFY',
      searchProfile: 'NONE',
      filters: {},
      rankingSignals: [],
      requiredFields: [],
      fallbackPolicy: 'ASK_FOR_MORE_INFO',
      hallucinationRisk: 'LOW'
    };
  }

  if (['CAREER_GUIDANCE', 'RESUME_HELP', 'RESUME'].includes(intent)) {
    return {
      action: 'DIRECT_ANSWER',
      searchProfile: 'KNOWLEDGE_BASE',
      filters: {},
      rankingSignals: ['intent_confidence', 'domain_confidence'],
      requiredFields: [],
      fallbackPolicy: 'SAFE_FALLBACK',
      hallucinationRisk: 'LOW'
    };
  }

  if (['JOB_QUERY', 'FIELD_DETAILS', 'RESULT_ADMIT_CARD', 'SCHOLARSHIP'].includes(intent)) {
    const filters = { ...entities };
    if (domain && domain !== 'GENERAL') filters.domain = domain;

    return {
      action: 'DATABASE_SEARCH',
      searchProfile: 'JOB_SEARCH',
      filters,
      rankingSignals: ['domain_match', 'entity_match', 'field_match', 'freshness'],
      requiredFields: profile.requestedField ? [profile.requestedField] : [],
      fallbackPolicy: 'SAFE_FALLBACK',
      hallucinationRisk: profile.requestedField ? 'MEDIUM' : 'LOW'
    };
  }

  return {
    action: 'SAFE_FALLBACK',
    searchProfile: 'NONE',
    filters: {},
    rankingSignals: [],
    requiredFields: [],
    fallbackPolicy: 'SAFE_FALLBACK',
    hallucinationRisk: 'LOW'
  };
}

module.exports = {
  plan,
  analyze: plan,
  default: plan
};
