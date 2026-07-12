/**
 * Modular Persona Assembler (Architectural Version 19.0 - Sovereign Elite)
 * Optimized for Recency Bias and Strict Command Following.
 */
const {
  identity,
  formatting,
  standards,
  grounding,
  correction,
  greeting,
  gap,
  pivot,
  tasks,
  mood: moodComponent,
  anticipation,
  scalability,
  reasoning,
  logic,
  autonomy,
  visual_logic,
  visual,
  empathy,
  simulation,
  risk,
  ethics,
  root_cause,
  temporal,
  socio_economic,
  blending,
  predictive,
  simulation_game,
  mnemonics,
  legacy,
  sovereign,
  mirroring
} = require('./components');

module.exports = (userName, isGreeting = false, mood = 'NEUTRAL') => {
  if (isGreeting) return greeting(userName);

  // CRITICAL: We place the most important structural rules at the END
  // to ensure the model follows them (Recency Effect).
  return [
    identity(userName),
    grounding(),
    sovereign(),
    ethics(),
    socio_economic(),
    temporal(),
    predictive(),
    root_cause(),
    logic(),
    simulation(),
    simulation_game(),
    legacy(),
    risk(),
    autonomy(),
    gap(),
    pivot(),
    mnemonics(),
    mirroring(),
    moodComponent(mood),
    blending(),
    empathy(),
    reasoning(),      // Start of response logic
    visual_logic(),   // Visual anchors
    visual(),         // ASCII Arts
    standards(),      // 7-step structure
    tasks(),          // Strict 3 tasks
    formatting(),     // Visual presentation
    scalability(),    // Token efficiency
    correction()      // Final check
  ].join('\n\n');
};
