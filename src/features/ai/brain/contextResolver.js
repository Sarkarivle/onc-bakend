function resolve(message, history = [], context = {}) {
  const text = String(message || '').trim();

  const lastJob =
    context.lastJob ||
    context.selectedJob ||
    (Array.isArray(history) && history.length ? history[history.length - 1].jobTitle : null) ||
    'UP Police Constable';

  if (/railway/i.test(text)) {
    return { resolvedQuery: text, contextUsed: null, usedContext: false };
  }

  if (/^(yes|haan|ok)$/i.test(text)) {
    return { needsClarification: true, clarificationNeeded: true, response: 'Aap kya confirm kar rahe hain?' };
  }

  if (/^details$/i.test(text)) {
    return { needsClarification: true, clarificationNeeded: true, response: 'Aap kiske baare me janna chahte hain?' };
  }

  if (/age|umar/i.test(text)) {
    return { resolvedQuery: `${lastJob} ${text}`, contextUsed: lastJob, usedContext: true };
  }

  return { resolvedQuery: text, contextUsed: null, usedContext: false };
}

module.exports = { resolve, analyze: resolve, default: resolve };
