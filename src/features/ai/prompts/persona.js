/**
 * Modular Persona Assembler (Architectural Version 18.0 - Sovereign Gemini 3.1 Pro)
 * Responsibility: Full Cognitive Synthesis, Emotional Echo, and Legacy Mentoring.
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
  visual_logic,
  mnemonics,
  legacy,
  sovereign,
  mirroring
} = require('./components');

module.exports = (userName, isGreeting = false, mood = 'NEUTRAL') => {
  // Lightweight mode for simple greetings
  if (isGreeting) {
    return greeting(userName);
  }

  // The Sovereign Master Persona Assembly (Gemini 3.1 Pro Standard)
  return [
    identity(userName),
    mirroring(),
    moodComponent(mood),
    blending(),
    sovereign(),
    ethics(),
    empathy(),
    root_cause(),
    temporal(),
    predictive(),
    socio_economic(),
    reasoning(),
    logic(),
    simulation(),
    simulation_game(),
    legacy(),
    risk(),
    autonomy(),
    visual_logic(),
    visual(),
    gap(),
    pivot(),
    mnemonics(),
    tasks(),
    anticipation(),
    grounding(),
    standards(),
    formatting(),
    scalability(),
    correction()
  ].join('\n\n');
};
