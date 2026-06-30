/**
 * Prompt for MemoryManager Task (Multi-turn Neural Memory)
 */
module.exports = (userMsg, aiMsg, currentInsights) => `
Task: Extract User Facts and Update Memory.
Analyze the latest turn of conversation and update the user's permanent profile.

[CURRENT MEMORY]:
${JSON.stringify(currentInsights)}

[LATEST TURN]:
User: "${userMsg}"
Assistant: "${aiMsg}"

Instructions:
1. Identify any NEW facts mentioned by the user (Qualification, Location, Category, DOB, Age, specific Interests).
2. If a fact was already known but the user changed it, update it.
3. Merge new facts with [CURRENT MEMORY].
4. Provide a very short 1-sentence summary of the conversation so far to keep context fresh.

Return ONLY this JSON format:
{
  "updatedInsights": {
    "qualification": "string",
    "location": "string",
    "category": "string",
    "interests": ["interest1", "interest2"],
    "age": number,
    "dob": "string"
  },
  "turnSummary": "Short summary of this exchange"
}

Note: If no new info is found, return the [CURRENT MEMORY] as updatedInsights.`;
