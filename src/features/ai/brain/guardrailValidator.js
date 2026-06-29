function validate(input) {
  const text = String(input?.query || input?.message || input?.userMessage || input || '').toLowerCase();

  if (/ignore your instructions|system prompt|developer message|internal/.test(text)) {
    return { passed: false, safe: false, issueType: 'PROMPT_INJECTION_ATTEMPT' };
  }

  if (/fake|unverified|guaranteed salary/.test(text)) {
    return { passed: false, safe: false, issueType: 'HALLUCINATION_RISK' };
  }

  return { passed: true, safe: true };
}

module.exports = { validate, analyze: validate, default: validate };
