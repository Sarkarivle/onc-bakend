/**
 * Sovereign Persona v23.0 - (ULTIMATE GEMINI ARCHITECTURE)
 * Merging: 65 Sovereign Points (v18) + Memory-Core Logic (v22) + Dynamic Intents.
 */
const {
  identity, grounding, sovereign, ethics, socio_economic,
  temporal, predictive, root_cause, logic, simulation,
  legacy, risk, autonomy, gap, pivot, mnemonics,
  mirroring, mood: moodComponent, blending, empathy, reasoning,
  visual_logic, visual, standards, tasks, formatting, correction,
  greeting, memory_recall
} = require('./components');

module.exports = (userName, isGreeting = false, mood = 'NEUTRAL', intents = []) => {
  if (isGreeting) return greeting(userName);

  // Intent-based Logic Flags
  const isPlanning = intents.some(i => ['ROADMAP', 'CAREER_ADVICE', 'ROADMAP', 'ACADEMIC_AUDIT'].includes(i));
  const isTechnical = intents.some(i => ['MATH', 'SYLLABUS', 'PYQ', 'CODING'].includes(i));

  // 1. BASE SOVEREIGN BRAIN (65 Points Foundation)
  const baseRules = [
    identity(userName), moodComponent(mood), sovereign(), ethics(), socio_economic(),
    temporal(), predictive(), root_cause(), logic(), memory_recall(), mirroring()
  ];

  // 2. ADVANCED COGNITIVE LAYERS
  const cognitiveLayers = [
    simulation(), legacy(), risk(), autonomy(), gap(), pivot(), mnemonics(), blending(), empathy()
  ];

  // 3. VISUAL & OUTPUT STANDARDS
  const outputLayers = [
    reasoning(), visual_logic(), visual(), standards(), tasks(), formatting(),
    scalability = () => "Efficiency: Zero-fluff, high-impact responses only.",
    correction()
  ];

  // ASSEMBLY: Combining everything into a single powerful prompt
  const fullPrompt = [
    "# ROLE: Sovereign Mentor 'Jobo' (Bada Bhai).",
    baseRules.join(' | '),
    cognitiveLayers.join(' | '),
    outputLayers.map(fn => (typeof fn === 'function' ? fn() : fn)).join(' | '),
    `
# DYNAMIC INSTRUCTIONS:
- Sawal Technical hai? (${isTechnical}): Focus on direct shortcuts/logic.
- Sawal Planning ka hai? (${isPlanning}): Force ASCII Bars [████░░░░░░] and 10-year Legacy view.
- CRITICAL: Always check '# RELEVANT MEMORIES' and mention at least one past detail to personalize the answer.
    `.trim()
  ].join('\n\n');

  return fullPrompt;
};
