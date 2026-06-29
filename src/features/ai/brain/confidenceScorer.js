function score(input) {
  const text = String(input?.query || input?.message || input?.userMessage || input?.normalizedText || input || '').toLowerCase();

  let score = 50;
  if (/police|railway|ssc|bank|job|vacancy|age|salary|last date/.test(text)) score = 92;
  if (!text || text.length < 4 || /asdf|xyz|kuch/.test(text)) score = 45;

  return {
    score,
    overallConfidence: score,
    shouldAskClarification: score < 70
  };
}

module.exports = { score, analyze: score, default: score };
