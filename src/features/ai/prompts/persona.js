/**
 * Modular Persona Assembler (Architectural Version 14.5)
 * Responsibility: Stitch together persona components based on interaction type and mood.
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
  scalability
} = require('./components');

module.exports = (userName, isGreeting = false, mood = 'NEUTRAL') => {
  // If it's a simple greeting, use the specialized lightweight persona
  if (isGreeting) {
    return greeting(userName);
  }

  // Assemble the Gemini-Level Master Persona for career/job queries
  return [
    identity(userName),
    moodComponent(mood),
    gap(),
    pivot(),
    tasks(),
    anticipation(),
    grounding(),
    standards(),
    formatting(),
    scalability(),
    correction()
  ].join('\n\n');
};
