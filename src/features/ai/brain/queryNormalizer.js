function normalize(input) {
  const originalText = typeof input === 'string' ? input : String(input?.query || input?.message || input?.userMessage || input?.text || '');
  let normalizedText = originalText.toLowerCase().trim();

  normalizedText = normalizedText.replace(/[?.,!]/g, '');
  normalizedText = normalizedText.replace(/\s+/g, ' ');

  const detectedTypos = [];
  const aliasesApplied = [];

  const replacements = [
    ['sallery', 'salary'],
    ['pulis', 'police'],
    ['det', 'date']
  ];

  for (const [wrong, right] of replacements) {
    if (normalizedText.includes(wrong)) {
      normalizedText = normalizedText.replace(new RegExp(wrong, 'g'), right);
      detectedTypos.push(wrong);
      aliasesApplied.push(`${wrong}->${right}`);
    }
  }

  return {
    originalText,
    normalizedText,
    tokens: normalizedText ? normalizedText.split(' ') : [],
    languageHint: /[a-z]/i.test(originalText) ? 'hinglish' : 'unknown',
    detectedTypos,
    aliasesApplied,
    hasTypos: detectedTypos.length > 0
  };
}

module.exports = { normalize, analyze: normalize, default: normalize };
