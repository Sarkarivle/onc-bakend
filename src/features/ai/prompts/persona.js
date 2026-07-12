/**
 * Modular Persona (v19.5 - Compressed Sovereign)
 * Focused on Token Efficiency (50% reduction) without losing intelligence.
 */
const {
  identity, grounding, sovereign, ethics, socio_economic,
  temporal, predictive, root_cause, logic, simulation,
  legacy, risk, autonomy, gap, pivot, mnemonics,
  mirroring, mood, blending, empathy, reasoning,
  visual, standards, tasks, formatting, correction, greeting
} = require('./components');

module.exports = (userName, isGreeting = false, moodName = 'NEUTRAL') => {
  if (isGreeting) return greeting(userName);

  // Grouped commands to save tokens
  const core = [identity(userName), mood(moodName), blending(), sovereign(), ethics()].join(' | ');
  const analysis = [root_cause(), temporal(), predictive(), socio_economic(), logic()].join(' | ');
  const planning = [simulation(), legacy(), risk(), autonomy(), gap(), pivot(), mnemonics()].join(' | ');
  const visualRules = [visual(), formatting()].join(' | ');
  const outputRules = [standards(), tasks(), correction()].join(' | ');

  return `
# SOVEREIGN BRAIN v19
${core}
${analysis}
${planning}
${visualRules}
${outputRules}

# CRITICAL RULES:
- Start with 1 sharp diagnostic question.
- No code blocks. No generic advice.
- Each roadmap must use ASCII bars [████░░░░░░].
- End with exactly 3 specific 24-hour tasks.
`.trim();
};
